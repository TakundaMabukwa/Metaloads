import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isDriverEligibleForAllocation } from "@/lib/services/allocation-eligibility"

export async function getAllocationsWorkspaceRepository() {
  const supabase = createServiceRoleClient()

  const [
    { data: vehiclesNeedingAllocation, error: vehiclesError },
    { data: allocatableDrivers, error: allocatableDriversError },
    { data: inactiveDrivers, error: inactiveDriversError },
    { data: activeAllocations, error: activeAllocationsError },
    { data: recentHistory, error: historyError },
  ] = await Promise.all([
    supabase
      .from("vehiclesc")
      .select(
        "id, vehicle_number, registration_number, display_label, make, model, vehicle_type, vehicle_priority, current_driver_id, current_driver_code, needs_allocation, allocation_locked"
      )
      .or("needs_allocation.eq.true,current_allocation_id.is.null")
      .eq("allocation_locked", false)
      .order("vehicle_priority", { ascending: false, nullsFirst: false })
      .order("vehicle_number", { ascending: true }),
    supabase
      .from("v_driver_live_status")
      .select("*")
      .eq("is_allocatable", true)
      .in("current_state", ["off", "active"])
      .order("state_started_on", { ascending: true }),
    supabase
      .from("v_driver_live_status")
      .select("*")
      .in("current_state", ["inactive", "off", "on_leave", "suspended"])
      .order("current_state_days", { ascending: false }),
    supabase
      .from("allocations")
      .select("id, driver_id, vehicle_id, status, allocation_type, started_at, effective_from, notes")
      .is("ended_at", null)
      .in("status", ["pending", "active", "locked"])
      .order("started_at", { ascending: false }),
    supabase.from("allocation_history").select("*").order("created_at", { ascending: false }).limit(20),
  ])

  if (vehiclesError) throw vehiclesError
  if (allocatableDriversError) throw allocatableDriversError
  if (inactiveDriversError) throw inactiveDriversError
  if (activeAllocationsError) throw activeAllocationsError
  if (historyError) throw historyError

  const driverIds = new Set<string>()
  const vehicleIds = new Set<string>()

  for (const allocation of activeAllocations ?? []) {
    if (allocation.driver_id) driverIds.add(allocation.driver_id as string)
    if (allocation.vehicle_id) vehicleIds.add(allocation.vehicle_id as string)
  }

  const [{ data: allocationDrivers, error: allocationDriversError }, { data: allocationVehicles, error: allocationVehiclesError }] =
    await Promise.all([
      driverIds.size
        ? supabase
            .from("drivers")
            .select("id, driver_code, first_name, surname, current_state, current_state_days, warning_level")
            .in("id", Array.from(driverIds))
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.size
        ? supabase
            .from("vehiclesc")
            .select("id, vehicle_number, registration_number, display_label, make, model")
            .in("id", Array.from(vehicleIds))
        : Promise.resolve({ data: [], error: null }),
    ])

  if (allocationDriversError) throw allocationDriversError
  if (allocationVehiclesError) throw allocationVehiclesError

  const driversById = new Map((allocationDrivers ?? []).map((row) => [row.id as string, row]))
  const vehiclesById = new Map((allocationVehicles ?? []).map((row) => [row.id as string, row]))

  const filteredAllocatableDrivers = (allocatableDrivers ?? []).filter((driver) =>
    isDriverEligibleForAllocation({
      current_state: driver.current_state as string | null,
      current_state_days: Number(driver.current_state_days ?? 0),
      current_leave_id: driver.current_leave_id as string | null,
      current_allocation_id: driver.current_allocation_id as string | null,
      is_allocatable: driver.is_allocatable as boolean | null,
    })
  )

  return {
    vehiclesNeedingAllocation: vehiclesNeedingAllocation ?? [],
    allocatableDrivers: filteredAllocatableDrivers,
    inactiveDrivers: inactiveDrivers ?? [],
    activeAllocations: (activeAllocations ?? []).map((allocation) => ({
      ...allocation,
      driver: driversById.get(allocation.driver_id as string) ?? null,
      vehicle: vehiclesById.get(allocation.vehicle_id as string) ?? null,
    })),
    recentHistory: recentHistory ?? [],
  }
}
