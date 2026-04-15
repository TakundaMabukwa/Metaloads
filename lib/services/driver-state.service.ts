import { requireRole } from "@/lib/auth/guards"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendDriverAllocationSms, sendDriverMovedOnSms } from "@/lib/services/sms.service"
import {
  moveDriverStateSchema,
  updateDriverStateSchema,
} from "@/lib/validators/driver"
import {
  endDriverLeaveSchema,
  markDriverLeaveSchema,
} from "@/lib/validators/leave"

export async function moveDriverOff(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = moveDriverStateSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc("upsert_driver_state_tx", {
    p_driver_id: payload.driverId,
    p_new_state: "off",
    p_reason_code: payload.reasonCode,
    p_note: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_source: "manual",
  })

  if (error) throw error

  return data
}

export async function moveDriverActive(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = updateDriverStateSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc("upsert_driver_state_tx", {
    p_driver_id: payload.driverId,
    p_new_state: "active",
    p_reason_code: "manual_active",
    p_note: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_source: "manual",
  })

  if (error) throw error

  const { data: activeVehicleAllocations, error: activeVehicleAllocationsError } = await supabase
    .from("allocations")
    .select("vehicle_id")
    .is("ended_at", null)
    .in("status", ["pending", "active", "locked"])

  if (activeVehicleAllocationsError) {
    await supabase.rpc("upsert_driver_state_tx", {
      p_driver_id: payload.driverId,
      p_new_state: "off",
      p_reason_code: "manual_active_failed",
      p_note: "Move active reverted because active vehicle allocations could not be loaded",
      p_actor_user_id: user.id,
      p_source: "system",
    })

    throw activeVehicleAllocationsError
  }

  const occupiedVehicleIds = (activeVehicleAllocations ?? [])
    .map((row) => row.vehicle_id)
    .filter(Boolean) as string[]

  let openVehicleQuery = supabase
    .from("vehiclesc")
    .select("id, vehicle_number, registration_number")
    .eq("allocation_locked", false)

  if (occupiedVehicleIds.length > 0) {
    openVehicleQuery = openVehicleQuery.not(
      "id",
      "in",
      `(${occupiedVehicleIds.map((id) => `"${id}"`).join(",")})`
    )
  }

  const { data: openVehicles, error: openVehiclesError } = await openVehicleQuery

  if (openVehiclesError) {
    await supabase.rpc("upsert_driver_state_tx", {
      p_driver_id: payload.driverId,
      p_new_state: "off",
      p_reason_code: "manual_active_failed",
      p_note: "Move active reverted because free vehicles could not be loaded",
      p_actor_user_id: user.id,
      p_source: "system",
    })

    throw openVehiclesError
  }

  if (!openVehicles || openVehicles.length === 0) {
    await supabase.rpc("upsert_driver_state_tx", {
      p_driver_id: payload.driverId,
      p_new_state: "off",
      p_reason_code: "manual_active_failed",
      p_note: "Move active reverted because no free vehicles were available",
      p_actor_user_id: user.id,
      p_source: "system",
    })

    throw new Error("No free vehicles are available to assign")
  }

  const randomVehicle = openVehicles[Math.floor(Math.random() * openVehicles.length)]

  const { data: allocationResult, error: allocationError } = await supabase.rpc("assign_driver_to_vehicle_tx", {
    p_vehicle_id: randomVehicle.id,
    p_driver_id: payload.driverId,
    p_effective_from: null,
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_allocation_type: "manual",
  })

  if (allocationError) {
    await supabase.rpc("upsert_driver_state_tx", {
      p_driver_id: payload.driverId,
      p_new_state: "off",
      p_reason_code: "manual_active_failed",
      p_note: "Move active reverted because vehicle assignment failed",
      p_actor_user_id: user.id,
      p_source: "system",
    })

    throw allocationError
  }

  try {
    await sendDriverMovedOnSms({
      driverId: payload.driverId,
      toNumber: "+27623662042",
    })
  } catch (smsError) {
    console.error("Failed to send move active SMS", smsError)
  }

  try {
    await sendDriverAllocationSms({
      driverId: payload.driverId,
      vehicleId: String(randomVehicle.id),
      effectiveFrom: null,
    })
  } catch (smsError) {
    console.error("Failed to send move active allocation SMS", smsError)
  }

  return allocationResult ?? data
}

export async function updateDriverState(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = updateDriverStateSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc("upsert_driver_state_tx", {
    p_driver_id: payload.driverId,
    p_new_state: payload.state,
    p_reason_code: "manual_status_update",
    p_note: payload.notes ?? null,
    p_actor_user_id: user.id,
    p_source: "manual",
  })

  if (error) throw error
  return data
}

export async function markDriverLeave(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = markDriverLeaveSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc("mark_driver_leave_tx", {
    p_driver_id: payload.driverId,
    p_leave_start: payload.leaveStart,
    p_leave_end: payload.leaveEnd,
    p_reason: payload.reason ?? null,
    p_notes: payload.notes ?? null,
    p_force_end_allocation: payload.forceEndAllocation ?? false,
    p_actor_user_id: user.id,
  })

  if (error) throw error
  return data
}

export async function endDriverLeave(input: unknown) {
  const user = await requireRole(["admin", "dispatcher"])
  const payload = endDriverLeaveSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc("end_driver_leave_tx", {
    p_leave_id: payload.leaveId,
    p_end_date: payload.endDate ?? null,
    p_notes: payload.notes ?? null,
    p_actor_user_id: user.id,
  })

  if (error) throw error
  return data
}

export async function recomputeDriverState(driverId: string) {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc("refresh_driver_snapshot", {
    p_driver_id: driverId,
    p_actor_user_id: null,
  })

  if (error) throw error
}
