import { NextResponse } from "next/server"
import { authorizeCronRequest } from "@/lib/auth/cron-request"
import { monitorDriverStates } from "@/lib/services/monitoring.service"

export async function POST(request: Request) {
  const auth = await authorizeCronRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await monitorDriverStates()
  return NextResponse.json(result)
}
