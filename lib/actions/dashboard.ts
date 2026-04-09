"use server"

import { requireRole } from "@/lib/auth/guards"
import { getDashboardSummaryRepository } from "@/lib/repositories/dashboard.repo"

export async function getDashboardSummary() {
  await requireRole(["admin", "dispatcher", "viewer"])
  return getDashboardSummaryRepository()
}

