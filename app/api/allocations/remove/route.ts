import { NextResponse } from "next/server"
import { removeAllocation } from "@/lib/services/allocations.service"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === "string" && value.trim()) return value
  }
  return "Failed to remove allocation"
}

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
      { success: false, error: errorMessage(error) },
      { status: 400 }
    )
  }
}
