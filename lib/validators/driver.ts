import { z } from "zod"

export const listDriversSchema = z.object({
  search: z.string().trim().optional(),
  state: z.enum(["active", "off", "inactive", "on_leave", "suspended"]).optional(),
  warningLevel: z.enum(["normal", "warning", "critical"]).optional(),
  available: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})

export const driverIdSchema = z.object({
  driverId: z.string().uuid(),
})

export const moveDriverStateSchema = z.object({
  driverId: z.string().uuid(),
  reasonCode: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(500).optional(),
  forceRemoveAllocation: z.boolean().optional(),
})

export const updateDriverStateSchema = z.object({
  driverId: z.string().uuid(),
  state: z.enum(["active", "off", "inactive", "on_leave", "suspended"]),
  notes: z.string().trim().max(500).optional(),
})

const driverUpsertBaseSchema = z.object({
  driverCode: z.string().trim().min(1).max(100),
  employeeNumber: z.string().trim().max(100).optional(),
  firstName: z.string().trim().min(1).max(120),
  surname: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(160).optional(),
  cellNumber: z.string().trim().max(30).optional(),
  emailAddress: z.string().trim().email().max(160).optional().or(z.literal("")),
  licenseNumber: z.string().trim().max(80).optional(),
  licenseExpiryDate: z.string().date().optional().or(z.literal("")),
  pdpExpiryDate: z.string().date().optional().or(z.literal("")),
  passportExpiry: z.string().date().optional().or(z.literal("")),
  trainingLastDone: z.string().trim().max(120).optional(),
  state: z.enum(["active", "off", "inactive", "on_leave", "suspended"]).default("off"),
  available: z.boolean().default(true),
  isAllocatable: z.boolean().default(true),
})

export const createDriverSchema = driverUpsertBaseSchema

export const updateDriverSchema = driverUpsertBaseSchema.extend({
  driverId: z.string().uuid(),
})
