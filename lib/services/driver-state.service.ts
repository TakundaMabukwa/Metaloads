import { requireRole } from "@/lib/auth/guards"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
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
  return data
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
