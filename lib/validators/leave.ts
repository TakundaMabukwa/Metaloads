import { z } from "zod"

export const markDriverLeaveSchema = z.object({
  driverId: z.string().uuid(),
  leaveStart: z.string().date(),
  leaveEnd: z.string().date(),
  reason: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  forceEndAllocation: z.boolean().optional(),
}).refine((value) => value.leaveEnd >= value.leaveStart, {
  message: "Leave end must be on or after leave start",
  path: ["leaveEnd"],
})

export const endDriverLeaveSchema = z.object({
  leaveId: z.string().uuid(),
  endDate: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
})

