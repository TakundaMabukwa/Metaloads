"use server"

import { requireRole } from "@/lib/auth/guards"
import {
  getVehicleDetailsRepository,
  listVehiclesRepository,
} from "@/lib/repositories/vehicles.repo"
import {
  assignDriverToVehicle,
  moveActiveDriverToVehicle,
  reassignDriver,
  removeAllocation,
} from "@/lib/services/allocations.service"
import { z } from "zod"

const listVehiclesSchema = z.object({
  search: z.string().trim().optional(),
  allocated: z.boolean().optional(),
  needsAllocation: z.boolean().optional(),
  branch: z.string().trim().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})

const vehicleIdSchema = z.object({
  vehicleId: z.string().uuid(),
})

export async function listVehicles(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = listVehiclesSchema.parse(input ?? {})
  return listVehiclesRepository(payload)
}

export async function getVehicleDetails(input: unknown) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const payload = vehicleIdSchema.parse(input)
  return getVehicleDetailsRepository(payload.vehicleId)
}

export async function assignDriverToVehicleAction(input: unknown) {
  return assignDriverToVehicle(input)
}

export async function reassignDriverAction(input: unknown) {
  return reassignDriver(input)
}

export async function removeDriverFromVehicleAction(input: unknown) {
  return removeAllocation(input)
}

export async function moveActiveDriverToVehicleAction(input: unknown) {
  return moveActiveDriverToVehicle(input)
}
