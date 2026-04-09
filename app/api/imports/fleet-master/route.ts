import { NextResponse } from "next/server"
import { importFleetMasterWorkbook } from "@/lib/services/fleet-master-import.service"

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 })
  }

  const result = await importFleetMasterWorkbook(file)
  return NextResponse.json(result)
}

