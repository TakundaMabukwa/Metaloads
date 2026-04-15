import { z } from "zod"

const vehicleUpsertBaseSchema = z.object({
  vehicleNumber: z.string().trim().min(1).max(100),
  registrationNumber: z.string().trim().max(100).optional(),
  displayLabel: z.string().trim().max(160).optional(),
  make: z.string().trim().max(120).optional(),
  model: z.string().trim().max(160).optional(),
  vehicleType: z.string().trim().max(120).optional(),
  vinNumber: z.string().trim().max(120).optional(),
  trailer1Registration: z.string().trim().max(120).optional(),
  trailer2Registration: z.string().trim().max(120).optional(),
  branchName: z.string().trim().max(120).optional(),
  dekraServiceStatus: z.string().trim().max(120).optional(),
  licenseExpiryDate: z.string().date().optional().or(z.literal("")),
  vehiclePriority: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.string().trim().max(80).default("active"),
  needsAllocation: z.boolean().default(true),
  allocationLocked: z.boolean().default(false),
})

export const createVehicleSchema = vehicleUpsertBaseSchema

export const updateVehicleSchema = vehicleUpsertBaseSchema.extend({
  vehicleId: z.string().uuid(),
})
