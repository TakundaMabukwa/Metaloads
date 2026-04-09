import * as XLSX from "xlsx"
import { requireRole } from "@/lib/auth/guards"
import { env } from "@/lib/env"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { rosterRowSchema, type RosterRowInput } from "@/lib/validators/roster"

type ParsedRosterRow = {
  employeeNumber: string
  firstName: string
  lastName: string
  start: string
  end: string
}

function excelDateToIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10)
  }

  if (typeof value === "string") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10)
    }
  }

  return null
}

function normalizeRosterRow(row: Record<string, unknown>): ParsedRosterRow {
  return {
    employeeNumber: String(row["Employee Number"] ?? row.employee_number ?? row.employeeNumber ?? "").trim(),
    firstName: String(row["First Name"] ?? row.first_name ?? row.firstName ?? "").trim(),
    lastName: String(row["Last Name"] ?? row.last_name ?? row.lastName ?? "").trim(),
    start: excelDateToIso(row["Start"] ?? row.start) ?? "",
    end: excelDateToIso(row["End"] ?? row.end) ?? "",
  }
}

async function matchDriver(row: RosterRowInput) {
  const supabase = createServiceRoleClient()

  const { data: exactEmployee } = await supabase
    .from("drivers")
    .select("id")
    .eq("employee_number", row.employeeNumber)
    .limit(2)

  if ((exactEmployee ?? []).length === 1) {
    return { status: "matched" as const, driverId: exactEmployee?.[0]?.id as string }
  }

  const { data: exactCode } = await supabase
    .from("drivers")
    .select("id")
    .eq("driver_code", row.employeeNumber)
    .limit(2)

  if ((exactCode ?? []).length === 1) {
    return { status: "matched" as const, driverId: exactCode?.[0]?.id as string }
  }

  const { data: nameMatches } = await supabase
    .from("drivers")
    .select("id")
    .ilike("first_name", row.firstName)
    .ilike("surname", row.lastName)
    .limit(2)

  if ((nameMatches ?? []).length === 1) {
    return { status: "matched" as const, driverId: nameMatches?.[0]?.id as string }
  }

  if ((nameMatches ?? []).length > 1) {
    return { status: "ambiguous" as const, driverId: null }
  }

  return { status: "unmatched" as const, driverId: null }
}

export async function importRosterSpreadsheet(file: File) {
  const user = await requireRole(["admin", "dispatcher"])
  const supabase = createServiceRoleClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(bytes, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error("Roster file does not contain a worksheet")
  }

  const worksheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name}`

  const uploadResult = await supabase.storage.from(env.rosterBucket).upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })

  if (uploadResult.error) throw uploadResult.error

  const { data: importJob, error: importError } = await supabase
    .from("employee_roster_imports")
    .insert({
      file_name: file.name,
      storage_path: storagePath,
      status: "processing",
      imported_by: user.id,
    })
    .select("*")
    .single()

  if (importError) throw importError

  let matchedRows = 0
  let unmatchedRows = 0
  let ambiguousRows = 0
  let errorRows = 0
  const affectedDriverIds = new Set<string>()

  for (let index = 0; index < rawRows.length; index++) {
    const normalized = normalizeRosterRow(rawRows[index])
    const parsed = rosterRowSchema.safeParse(normalized)

    if (!parsed.success) {
      errorRows++
      await supabase.from("employee_roster_import_rows").insert({
        import_id: importJob.id,
        row_number: index + 1,
        employee_number: normalized.employeeNumber || null,
        first_name: normalized.firstName || null,
        last_name: normalized.lastName || null,
        period_start: normalized.start || null,
        period_end: normalized.end || null,
        match_status: "invalid",
        errors: parsed.error.flatten(),
        raw_payload: rawRows[index],
      })
      continue
    }

    const match = await matchDriver(parsed.data)

    await supabase.from("employee_roster_import_rows").insert({
      import_id: importJob.id,
      row_number: index + 1,
      employee_number: parsed.data.employeeNumber,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      period_start: parsed.data.start,
      period_end: parsed.data.end,
      matched_driver_id: match.driverId,
      match_status: match.status,
      errors: [],
      raw_payload: rawRows[index],
    })

    if (match.status === "matched" && match.driverId) {
      matchedRows++
      affectedDriverIds.add(match.driverId)
      await supabase.from("driver_roster_periods").insert({
        driver_id: match.driverId,
        employee_number: parsed.data.employeeNumber,
        period_start: parsed.data.start,
        period_end: parsed.data.end,
        source_import_id: importJob.id,
      })
    } else if (match.status === "ambiguous") {
      ambiguousRows++
    } else {
      unmatchedRows++
    }
  }

  await supabase
    .from("employee_roster_imports")
    .update({
      status: "completed",
      total_rows: rawRows.length,
      matched_rows: matchedRows,
      unmatched_rows: unmatchedRows,
      ambiguous_rows: ambiguousRows,
      error_rows: errorRows,
      finished_at: new Date().toISOString(),
      summary: { matchedRows, unmatchedRows, ambiguousRows, errorRows },
    })
    .eq("id", importJob.id)

  for (const driverId of affectedDriverIds) {
    await supabase.rpc("refresh_driver_snapshot", {
      p_driver_id: driverId,
      p_actor_user_id: user.id,
    })
  }

  return {
    importId: importJob.id as string,
    totalRows: rawRows.length,
    matchedRows,
    unmatchedRows,
    ambiguousRows,
    errorRows,
  }
}
