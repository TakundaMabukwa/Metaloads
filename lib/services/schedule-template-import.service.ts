import * as XLSX from "xlsx"
import { requireRole } from "@/lib/auth/guards"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function extractDriverNumber(label: string) {
  const match = label.match(/(\d+)/)
  return match?.[1] ?? null
}

function extractVehicleCandidates(label: string) {
  const trimmed = label.trim()
  const numeric = trimmed.replace(/^truck\s*/i, "").trim()
  return [trimmed, numeric].filter(Boolean)
}

async function findDriverId(label: string) {
  const supabase = createServiceRoleClient()
  const driverNumber = extractDriverNumber(label)
  if (!driverNumber) return null

  const { data } = await supabase
    .from("drivers")
    .select("id")
    .or(`employee_number.eq.${driverNumber},driver_code.eq.${driverNumber}`)
    .limit(2)

  return (data ?? []).length === 1 ? ((data?.[0]?.id as string) ?? null) : null
}

async function findVehicleId(label: string) {
  const supabase = createServiceRoleClient()
  const candidates = extractVehicleCandidates(label)

  for (const candidate of candidates) {
    const { data } = await supabase
      .from("vehiclesc")
      .select("id")
      .eq("vehicle_number", candidate)
      .limit(2)

    if ((data ?? []).length === 1) {
      return (data?.[0]?.id as string) ?? null
    }
  }

  return null
}

export async function importSchedulingTemplate(file: File) {
  const user = await requireRole(["admin", "dispatcher"])
  const supabase = createServiceRoleClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(bytes, { type: "buffer" })
  const sheet = workbook.Sheets["Truck"]

  if (!sheet) {
    throw new Error("Scheduling file must contain a Truck sheet")
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
  const importBatchId = crypto.randomUUID()

  await supabase
    .from("vehicle_rotation_plan_items")
    .update({ status: "cancelled" })
    .eq("source_file_name", file.name)
    .in("status", ["planned", "ready"])

  let imported = 0
  let matchedVehicles = 0
  let matchedDrivers = 0

  for (const row of rows) {
    const vehicleLabel = String(row["Truck"] ?? "").trim()
    const currentDriverLabel = String(row["Current driver allocated"] ?? "").trim()
    const nextDriverLabel = String(row["Next driver"] ?? "").trim()

    if (!vehicleLabel || !nextDriverLabel) continue

    const vehicleId = await findVehicleId(vehicleLabel)
    const currentDriverId = currentDriverLabel ? await findDriverId(currentDriverLabel) : null
    const nextDriverId = await findDriverId(nextDriverLabel)

    const daysOn = Number.parseInt(String(row["Driver on for (Days)"] ?? ""), 10)
    const cycleStartDate = String(row["Started "] ?? "").trim() || null
    const proposedChangeDate = String(row["Proposed end (28 day cycle)"] ?? "").trim() || null
    const notes = String(row["Reason"] ?? row[""] ?? "").trim() || null

    const { error } = await supabase.from("vehicle_rotation_plan_items").insert({
      source_file_name: file.name,
      source_sheet: "Truck",
      vehicle_id: vehicleId,
      vehicle_label: vehicleLabel,
      current_driver_id: currentDriverId,
      current_driver_label: currentDriverLabel || null,
      next_driver_id: nextDriverId,
      next_driver_label: nextDriverLabel,
      cycle_start_date: cycleStartDate || null,
      proposed_change_date: proposedChangeDate || null,
      days_on: Number.isNaN(daysOn) ? null : daysOn,
      status: nextDriverId ? "ready" : "planned",
      notes,
      import_batch_id: importBatchId,
    })

    if (error) throw error

    imported++
    if (vehicleId) matchedVehicles++
    if (nextDriverId) matchedDrivers++
  }

  return {
    fileName: file.name,
    importBatchId,
    imported,
    matchedVehicles,
    matchedDrivers,
    actorUserId: user.id,
  }
}
