import { NextResponse } from "next/server"
import { moveDriverActive } from "@/lib/services/driver-state.service"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === "string" && value.trim()) return value
  }
  return "Failed to move driver active"
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await moveDriverActive({
      driverId: body.driverId,
      state: "active",
      notes: body.notes ?? undefined,
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: errorMessage(error) },
      { status: 400 }
    )
  }
}
