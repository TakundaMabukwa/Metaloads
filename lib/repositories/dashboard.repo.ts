import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isDriverEligibleForAllocation } from "@/lib/services/allocation-eligibility"

function datePlusDays(days: number) {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * days).toISOString().slice(0, 10)
}

export async function getDashboardSummaryRepository() {
  const supabase = createServiceRoleClient()
  const threshold = datePlusDays(30)

  const [
    { data: summary, error },
    { data: activeDriverBoard },
    { data: offDriverBoard },
    { data: replacementDriverPool },
    { data: openVehiclePool },
    { data: expiryAlerts },
  ] = await Promise.all([
    supabase.from("v_dashboard_summary").select("*").single(),
    supabase
      .from("drivers")
      .select("id, driver_code, first_name, surname, current_state, current_state_days, current_vehicle_id, current_allocation_id, warning_level")
      .eq("current_state", "active")
      .order("current_state_days", { ascending: false })
      .order("surname", { ascending: true }),
    supabase
      .from("drivers")
      .select("id, driver_code, first_name, surname, current_state, current_state_days, current_vehicle_id, current_allocation_id, warning_level")
      .in("current_state", ["off", "inactive"])
      .order("current_state_days", { ascending: false })
      .order("surname", { ascending: true }),
    supabase
      .from("drivers")
      .select("id, driver_code, first_name, surname, current_state, current_state_days, current_vehicle_id, current_allocation_id, current_leave_id, is_allocatable")
      .is("current_allocation_id", null)
      .order("surname", { ascending: true }),
    supabase
      .from("vehiclesc")
      .select("id, vehicle_number, registration_number, current_allocation_id, current_driver_id, allocation_locked")
      .is("current_allocation_id", null)
      .is("current_driver_id", null)
      .eq("allocation_locked", false)
      .order("vehicle_number", { ascending: true }),
    supabase
      .from("drivers")
      .select("id, driver_code, first_name, surname, license_expiry_date, pdp_expiry_date")
      .or(`license_expiry_date.lte.${threshold},pdp_expiry_date.lte.${threshold}`),
  ])

  if (error) throw error

  const activeVehicleIds = Array.from(
    new Set((activeDriverBoard ?? []).map((driver) => driver.current_vehicle_id).filter(Boolean) as string[])
  )

  const { data: activeVehicleRows, error: activeVehicleRowsError } = activeVehicleIds.length
    ? await supabase
        .from("vehiclesc")
        .select("id, vehicle_number, registration_number")
        .in("id", activeVehicleIds)
    : { data: [], error: null }

  if (activeVehicleRowsError) throw activeVehicleRowsError

  const activeVehiclesById = new Map((activeVehicleRows ?? []).map((vehicle) => [vehicle.id as string, vehicle]))

  const eligibleReplacementDrivers = (replacementDriverPool ?? []).filter((driver) =>
    isDriverEligibleForAllocation({
      current_state: driver.current_state as string | null,
      current_state_days: Number(driver.current_state_days ?? 0),
      current_leave_id: driver.current_leave_id as string | null,
      current_allocation_id: driver.current_allocation_id as string | null,
      is_allocatable: driver.is_allocatable as boolean | null,
    })
  )

  return {
    summary,
    activeDriverBoard: (activeDriverBoard ?? []).map((driver) => ({
      ...driver,
      current_vehicle: activeVehiclesById.get(driver.current_vehicle_id as string) ?? null,
    })),
    offDriverBoard: offDriverBoard ?? [],
    replacementDriverPool: eligibleReplacementDrivers,
    openVehiclePool: openVehiclePool ?? [],
    expiryAlerts: expiryAlerts ?? [],
  }
}
