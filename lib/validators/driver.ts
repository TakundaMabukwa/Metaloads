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

