"use server"

import { requireRole } from "@/lib/auth/guards"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isDriverEligibleForAllocation } from "@/lib/services/allocation-eligibility"
import { autoAllocateVehicles } from "@/lib/services/monitoring.service"
import { allocationListFiltersSchema } from "@/lib/validators/allocation"
import { z } from "zod"

const allocatableDriversSchema = z.object({
  includeInactive: z.boolean().optional(),
})

const inactiveDriversSchema = z.object({
  includeLeave: z.boolean().optional(),
})

export async function listVehiclesNeedingAllocation() {
  await requireRole(["admin", "dispatcher", "viewer"])
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("vehiclesc")
    .select("*")
    .eq("needs_allocation", true)
    .order("vehicle_priority", { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listAllocatableDrivers(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = allocatableDriversSchema.parse(input ?? {})
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from("v_driver_live_status")
    .select("*")
    .eq("is_allocatable", true)

  if (!payload.includeInactive) {
    query = query.in("current_state", ["off", "active"])
  }

  const { data, error } = await query.order("state_started_on", { ascending: true })
  if (error) throw error
  return (data ?? []).filter((driver) =>
    isDriverEligibleForAllocation({
      current_state: driver.current_state as string | null,
      current_state_days: Number(driver.current_state_days ?? 0),
      current_leave_id: driver.current_leave_id as string | null,
      current_allocation_id: driver.current_allocation_id as string | null,
      is_allocatable: driver.is_allocatable as boolean | null,
    })
  )
}

export async function listInactiveOrOffDrivers(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = inactiveDriversSchema.parse(input ?? {})
  const supabase = await createServerSupabaseClient()
  const states = payload.includeLeave ? ["inactive", "off", "on_leave"] : ["inactive", "off"]
  const { data, error } = await supabase
    .from("v_driver_live_status")
    .select("*")
    .in("current_state", states)
    .order("current_state_days", { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAllocationHistory(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = allocationListFiltersSchema.parse(input ?? {})
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from("allocation_history")
    .select("*", { count: "exact" })
    .range((payload.page - 1) * payload.pageSize, payload.page * payload.pageSize - 1)
    .order("created_at", { ascending: false })

  if (payload.vehicleId) {
    query = query.or(`to_vehicle_id.eq.${payload.vehicleId},from_vehicle_id.eq.${payload.vehicleId}`)
  }

  if (payload.driverId) {
    query = query.or(`to_driver_id.eq.${payload.driverId},from_driver_id.eq.${payload.driverId}`)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    rows: data ?? [],
    total: count ?? 0,
    page: payload.page,
    pageSize: payload.pageSize,
  }
}

export async function triggerAutoAllocationAction() {
  await requireRole(["admin", "dispatcher"])
  return autoAllocateVehicles()
}
