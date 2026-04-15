import { NextResponse } from "next/server"
import { getCronSecret } from "@/lib/env"
import { monitorDriverStates } from "@/lib/services/monitoring.service"

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
}

function isAuthorized(request: Request) {
  const secret = getCronSecret()
  if (!secret) {
    return isLocalRequest(request)
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return token === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await monitorDriverStates()
  return NextResponse.json(result)
}
