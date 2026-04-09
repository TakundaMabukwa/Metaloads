import { NextResponse } from "next/server"
import { requireCronSecret } from "@/lib/env"
import { monitorDriverStates } from "@/lib/services/monitoring.service"

function isAuthorized(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return token === requireCronSecret()
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await monitorDriverStates()
  return NextResponse.json(result)
}

