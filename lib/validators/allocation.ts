import { z } from "zod"

export const assignDriverSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  effectiveFrom: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
})

export const reassignDriverSchema = z.object({
  vehicleId: z.string().uuid(),
  newDriverId: z.string().uuid(),
  effectiveFrom: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
  allowOverrideLocked: z.boolean().optional(),
})

export const moveActiveDriverVehicleSchema = z.object({
  allocationId: z.string().uuid(),
  targetVehicleId: z.string().uuid(),
  effectiveFrom: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
})

export const removeAllocationSchema = z.object({
  allocationId: z.string().uuid(),
  endedReason: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).optional(),
})

export const allocationListFiltersSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})
