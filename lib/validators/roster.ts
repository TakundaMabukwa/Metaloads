import { z } from "zod"

export const rosterRowSchema = z.object({
  employeeNumber: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  start: z.string().date(),
  end: z.string().date(),
}).refine((value) => value.end >= value.start, {
  message: "End must be on or after start",
  path: ["end"],
})

export type RosterRowInput = z.infer<typeof rosterRowSchema>
