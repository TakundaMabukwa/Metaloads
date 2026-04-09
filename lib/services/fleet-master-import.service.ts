import * as XLSX from "xlsx"
import { requireRole } from "@/lib/auth/guards"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function sheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeEmployeeRow(row: Record<string, unknown>) {
  return {
    employeeNumber: normalizeText(row["Employee Number"]),
    firstName: normalizeText(row["First Name"]),
    lastName: normalizeText(row["Last Name"]),
    licenseExpiry: normalizeText(row["License expires"]),
    pdpExpiry: normalizeText(row["PDP expires"]),
  }
}

function normalizeVehicleRow(row: Record<string, unknown>) {
  return {
    displayNr: normalizeText(row["Display nr"]),
    assetNr: normalizeText(row["Asset nr"]),
    registrationNumber: normalizeText(row["reg number"]),
    trailer1: normalizeText(row["Trailer 1"]),
    trailer2: normalizeText(row["Trailer 2"]),
    vinNumber: normalizeText(row["Vin number"]),
    type: normalizeText(row["Type"]),
  }
}

function toNullableDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export async function importFleetMasterWorkbook(file: File) {
  const user = await requireRole(["admin", "dispatcher"])
  const supabase = createServiceRoleClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(bytes, { type: "buffer" })
  const employeeRows = sheetRows(workbook, "Employees")
  const fleetRows = sheetRows(workbook, "Fleet")

  let createdDrivers = 0
  let updatedDrivers = 0
  let createdVehicles = 0
  let updatedVehicles = 0

  for (const rawRow of employeeRows) {
    const row = normalizeEmployeeRow(rawRow)
    if (!row.employeeNumber || !row.firstName) continue

    const payload = {
      employee_number: row.employeeNumber,
      driver_code: row.employeeNumber,
      first_name: row.firstName,
      surname: row.lastName || null,
      license_expiry_date: toNullableDate(row.licenseExpiry),
      pdp_expiry_date: toNullableDate(row.pdpExpiry),
    }

    const { data: existing } = await supabase
      .from("drivers")
      .select("id")
      .eq("employee_number", row.employeeNumber)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from("drivers").update(payload).eq("id", existing.id)
      if (error) throw error
      updatedDrivers++
    } else {
      const { error } = await supabase.from("drivers").insert({
        ...payload,
        current_state: "off",
        state_started_on: new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
      createdDrivers++
    }
  }

  for (const rawRow of fleetRows) {
    const row = normalizeVehicleRow(rawRow)
    if (!row.assetNr || !row.registrationNumber) continue

    const payload = {
      vehicle_number: row.assetNr,
      registration_number: row.registrationNumber,
      make: row.type || null,
      model: row.displayNr || null,
      vehicle_type: row.type || null,
      status: "active",
      branch_name: null,
    }

    const { data: existing } = await supabase
      .from("vehiclesc")
      .select("id")
      .eq("registration_number", row.registrationNumber)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from("vehiclesc").update(payload).eq("id", existing.id)
      if (error) throw error
      updatedVehicles++
    } else {
      const { error } = await supabase.from("vehiclesc").insert(payload)
      if (error) throw error
      createdVehicles++
    }
  }

  return {
    fileName: file.name,
    employeesProcessed: employeeRows.length,
    fleetProcessed: fleetRows.length,
    createdDrivers,
    updatedDrivers,
    createdVehicles,
    updatedVehicles,
    actorUserId: user.id,
  }
}

