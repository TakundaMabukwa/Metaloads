import { NextResponse } from "next/server"
import { getDashboardSummary } from "@/lib/actions/dashboard"

export async function GET() {
  const result = await getDashboardSummary()
  return NextResponse.json(result)
}

