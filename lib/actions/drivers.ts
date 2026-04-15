"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/guards"
import {
  getDriverDetailsRepository,
  listDriversRepository,
} from "@/lib/repositories/drivers.repo"
import {
  endDriverLeave,
  markDriverLeave,
  moveDriverActive,
  moveDriverOff,
  updateDriverState,
} from "@/lib/services/driver-state.service"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  createDriverSchema,
  driverIdSchema,
  listDriversSchema,
  updateDriverSchema,
} from "@/lib/validators/driver"

function optionalText(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function optionalDate(value?: string) {
  return value ? value : null
}

function revalidateDriverPages() {
  revalidatePath("/dashboard")
  revalidatePath("/drivers")
  revalidatePath("/allocations")
}

export async function listDrivers(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = listDriversSchema.parse(input ?? {})
  return listDriversRepository(payload)
}

export async function getDriverDetails(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = driverIdSchema.parse(input)
  return getDriverDetailsRepository(payload.driverId)
}

export async function markDriverLeaveAction(input: unknown) {
  return markDriverLeave(input)
}

export async function endDriverLeaveAction(input: unknown) {
  return endDriverLeave(input)
}

export async function moveDriverOffAction(input: unknown) {
  return moveDriverOff(input)
}

export async function moveDriverActiveAction(input: unknown) {
  return moveDriverActive(input)
}

export async function updateDriverStateAction(input: unknown) {
  return updateDriverState(input)
}

export async function createDriverAction(input: unknown) {
  await requireRole(["admin", "dispatcher"])
  const payload = createDriverSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data: driver, error } = await supabase
    .from("drivers")
    .insert({
      driver_code: payload.driverCode,
      employee_number: optionalText(payload.employeeNumber),
      first_name: payload.firstName,
      surname: payload.surname,
      display_name: optionalText(payload.displayName) ?? `${payload.driverCode} - ${payload.firstName} ${payload.surname}`,
      cell_number: optionalText(payload.cellNumber),
      email_address: optionalText(payload.emailAddress),
      license_number: optionalText(payload.licenseNumber),
      license_expiry_date: optionalDate(payload.licenseExpiryDate),
      pdp_expiry_date: optionalDate(payload.pdpExpiryDate),
      passport_expiry: optionalDate(payload.passportExpiry),
      training_last_done: optionalText(payload.trainingLastDone),
      status: payload.state.toUpperCase(),
      available: payload.available,
      current_state: payload.state,
      state_started_on: new Date().toISOString().slice(0, 10),
      is_allocatable: payload.isAllocatable,
    })
    .select("id")
    .single()

  if (error) throw error

  await supabase.from("driver_state_history").insert({
    driver_id: driver.id,
    state: payload.state,
    effective_from: new Date().toISOString().slice(0, 10),
    source: "manual",
    reason_code: "driver_created",
  })

  await supabase.rpc("refresh_driver_snapshot", { p_driver_id: driver.id, p_actor_user_id: null })

  revalidateDriverPages()
  return driver
}

export async function updateDriverAction(input: unknown) {
  await requireRole(["admin", "dispatcher"])
  const payload = updateDriverSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data: existing, error: existingError } = await supabase
    .from("drivers")
    .select("id, current_state")
    .eq("id", payload.driverId)
    .single()

  if (existingError) throw existingError

  const { error } = await supabase
    .from("drivers")
    .update({
      driver_code: payload.driverCode,
      employee_number: optionalText(payload.employeeNumber),
      first_name: payload.firstName,
      surname: payload.surname,
      display_name: optionalText(payload.displayName) ?? `${payload.driverCode} - ${payload.firstName} ${payload.surname}`,
      cell_number: optionalText(payload.cellNumber),
      email_address: optionalText(payload.emailAddress),
      license_number: optionalText(payload.licenseNumber),
      license_expiry_date: optionalDate(payload.licenseExpiryDate),
      pdp_expiry_date: optionalDate(payload.pdpExpiryDate),
      passport_expiry: optionalDate(payload.passportExpiry),
      training_last_done: optionalText(payload.trainingLastDone),
      available: payload.available,
      is_allocatable: payload.isAllocatable,
      status: payload.state.toUpperCase(),
    })
    .eq("id", payload.driverId)

  if (error) throw error

  if (existing.current_state !== payload.state) {
    const { error: rpcError } = await supabase.rpc("upsert_driver_state_tx", {
      p_driver_id: payload.driverId,
      p_new_state: payload.state,
      p_reason_code: "driver_edited",
      p_note: "Driver edited from drivers modal",
      p_actor_user_id: null,
      p_source: "manual",
    })

    if (rpcError) throw rpcError
  } else {
    const { error: refreshError } = await supabase.rpc("refresh_driver_snapshot", {
      p_driver_id: payload.driverId,
      p_actor_user_id: null,
    })

    if (refreshError) throw refreshError
  }

  revalidateDriverPages()
  return { id: payload.driverId }
}
