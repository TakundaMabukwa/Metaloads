import { NextResponse } from "next/server"
import { moveDriverActive } from "@/lib/services/driver-state.service"

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
      { success: false, error: error instanceof Error ? error.message : "Failed to move driver active" },
      { status: 400 }
    )
  }
}
