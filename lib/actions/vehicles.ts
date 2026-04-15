"use server"

import { revalidatePath } from "next/cache"
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
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createVehicleSchema, updateVehicleSchema } from "@/lib/validators/vehicle"
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

function optionalText(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function optionalDate(value?: string) {
  return value ? value : null
}

function revalidateVehiclePages() {
  revalidatePath("/dashboard")
  revalidatePath("/vehicles")
  revalidatePath("/allocations")
}

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

export async function createVehicleAction(input: unknown) {
  await requireRole(["admin", "dispatcher"])
  const payload = createVehicleSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { data: vehicle, error } = await supabase
    .from("vehiclesc")
    .insert({
      vehicle_number: payload.vehicleNumber,
      registration_number: optionalText(payload.registrationNumber),
      display_label: optionalText(payload.displayLabel) ?? payload.vehicleNumber,
      make: optionalText(payload.make),
      model: optionalText(payload.model),
      vehicle_type: optionalText(payload.vehicleType),
      vin_number: optionalText(payload.vinNumber),
      trailer_1_registration: optionalText(payload.trailer1Registration),
      trailer_2_registration: optionalText(payload.trailer2Registration),
      branch_name: optionalText(payload.branchName),
      dekra_service_status: optionalText(payload.dekraServiceStatus),
      license_expiry_date: optionalDate(payload.licenseExpiryDate),
      vehicle_priority: payload.vehiclePriority,
      status: payload.status,
      needs_allocation: payload.needsAllocation,
      allocation_locked: payload.allocationLocked,
    })
    .select("id")
    .single()

  if (error) throw error

  const { error: refreshError } = await supabase.rpc("refresh_vehicle_snapshot", {
    p_vehicle_id: vehicle.id,
  })

  if (refreshError) throw refreshError

  revalidateVehiclePages()
  return vehicle
}

export async function updateVehicleAction(input: unknown) {
  await requireRole(["admin", "dispatcher"])
  const payload = updateVehicleSchema.parse(input)
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from("vehiclesc")
    .update({
      vehicle_number: payload.vehicleNumber,
      registration_number: optionalText(payload.registrationNumber),
      display_label: optionalText(payload.displayLabel) ?? payload.vehicleNumber,
      make: optionalText(payload.make),
      model: optionalText(payload.model),
      vehicle_type: optionalText(payload.vehicleType),
      vin_number: optionalText(payload.vinNumber),
      trailer_1_registration: optionalText(payload.trailer1Registration),
      trailer_2_registration: optionalText(payload.trailer2Registration),
      branch_name: optionalText(payload.branchName),
      dekra_service_status: optionalText(payload.dekraServiceStatus),
      license_expiry_date: optionalDate(payload.licenseExpiryDate),
      vehicle_priority: payload.vehiclePriority,
      status: payload.status,
      needs_allocation: payload.needsAllocation,
      allocation_locked: payload.allocationLocked,
    })
    .eq("id", payload.vehicleId)

  if (error) throw error

  const { error: refreshError } = await supabase.rpc("refresh_vehicle_snapshot", {
    p_vehicle_id: payload.vehicleId,
  })

  if (refreshError) throw refreshError

  revalidateVehiclePages()
  return { id: payload.vehicleId }
}
