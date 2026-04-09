"use server"

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
import { driverIdSchema, listDriversSchema } from "@/lib/validators/driver"

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

