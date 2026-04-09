import { requireRole } from "@/lib/auth/guards"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isDriverEligibleForAllocation } from "@/lib/services/allocation-eligibility"
import {
  assignDriverSchema,
  moveActiveDriverVehicleSchema,
  reassignDriverSchema,
  removeAllocationSchema,
} from "@/lib/validators/allocation"

export async function assignDriverToVehicle(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = assignDriverSchema.parse(input)
  const supabase = await createServerSupabaseClient()

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, current_state, current_state_days, current_leave_id, current_allocation_id, is_allocatable")
    .eq("id", payload.driverId)
    .single()

  if (driverError) throw driverError

  if (
    !isDriverEligibleForAllocation({
      current_state: driver.current_state as string | null,
      current_state_days: Number(driver.current_state_days ?? 0),
      current_leave_id: driver.current_leave_id as string | null,
      current_allocation_id: driver.current_allocation_id as string | null,
      is_allocatable: driver.is_allocatable as boolean | null,
    })
  ) {
    throw new Error("Driver is not eligible for allocation yet")
  }

  const { data, error } = await supabase.rpc("assign_driver_to_vehicle_tx", {
    p_vehicle_id: payload.vehicleId,
    p_driver_id: payload.driverId,
    p_effective_from: payload.effectiveFrom ?? null,
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_allocation_type: "manual",
  })

  if (error) throw error
  return data
}

export async function reassignDriver(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = reassignDriverSchema.parse(input)
  const supabase = await createServerSupabaseClient()

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, current_state, current_state_days, current_leave_id, current_allocation_id, is_allocatable")
    .eq("id", payload.newDriverId)
    .single()

  if (driverError) throw driverError

  if (
    !isDriverEligibleForAllocation({
      current_state: driver.current_state as string | null,
      current_state_days: Number(driver.current_state_days ?? 0),
      current_leave_id: driver.current_leave_id as string | null,
      current_allocation_id: driver.current_allocation_id as string | null,
      is_allocatable: driver.is_allocatable as boolean | null,
    })
  ) {
    throw new Error("Driver is not eligible for allocation yet")
  }

  const { data, error } = await supabase.rpc("reassign_driver_tx", {
    p_vehicle_id: payload.vehicleId,
    p_new_driver_id: payload.newDriverId,
    p_effective_from: payload.effectiveFrom ?? null,
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_allow_override_locked: payload.allowOverrideLocked ?? false,
  })

  if (error) throw error
  return data
}

export async function removeAllocation(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = removeAllocationSchema.parse(input)
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc("remove_allocation_tx", {
    p_allocation_id: payload.allocationId,
    p_ended_reason: payload.endedReason,
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
  })

  if (error) throw error
  return data
}

export async function moveActiveDriverToVehicle(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = moveActiveDriverVehicleSchema.parse(input)
  const supabase = await createServerSupabaseClient()

  const { data: allocation, error: allocationError } = await supabase
    .from("allocations")
    .select("id, driver_id, vehicle_id, ended_at, status")
    .eq("id", payload.allocationId)
    .maybeSingle()

  if (allocationError) throw allocationError
  if (!allocation || allocation.ended_at) {
    throw new Error("Active allocation not found")
  }

  if (String(allocation.vehicle_id) === payload.targetVehicleId) {
    throw new Error("Driver is already assigned to that vehicle")
  }

  const { data: targetVehicle, error: targetVehicleError } = await supabase
    .from("vehiclesc")
    .select("id, current_allocation_id, allocation_locked")
    .eq("id", payload.targetVehicleId)
    .maybeSingle()

  if (targetVehicleError) throw targetVehicleError
  if (!targetVehicle) {
    throw new Error("Target vehicle not found")
  }
  if (targetVehicle.allocation_locked) {
    throw new Error("Target vehicle is locked")
  }
  if (targetVehicle.current_allocation_id) {
    throw new Error("Target vehicle already has an allocation")
  }

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, current_state, current_state_days, current_leave_id, current_allocation_id, is_allocatable")
    .eq("id", allocation.driver_id)
    .single()

  if (driverError) throw driverError

  if (
    !isDriverEligibleForAllocation({
      current_state: driver.current_state as string | null,
      current_state_days: Number(driver.current_state_days ?? 0),
      current_leave_id: driver.current_leave_id as string | null,
      current_allocation_id: null,
      is_allocatable: driver.is_allocatable as boolean | null,
    })
  ) {
    throw new Error("Driver is not eligible to move to another vehicle")
  }

  const { error: removeError } = await supabase.rpc("remove_allocation_tx", {
    p_allocation_id: payload.allocationId,
    p_ended_reason: "vehicle_move",
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
  })

  if (removeError) throw removeError

  const { data, error } = await supabase.rpc("assign_driver_to_vehicle_tx", {
    p_vehicle_id: payload.targetVehicleId,
    p_driver_id: allocation.driver_id,
    p_effective_from: payload.effectiveFrom ?? null,
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_allocation_type: "manual",
  })

  if (error) throw error
  return data
}
