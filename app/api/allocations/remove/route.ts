import { NextResponse } from "next/server"
import { removeAllocation } from "@/lib/services/allocations.service"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await removeAllocation({
      allocationId: body.allocationId,
      endedReason: body.endedReason ?? "manual_remove",
      notes: body.notes ?? undefined,
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to remove allocation" },
      { status: 400 }
    )
  }
}
