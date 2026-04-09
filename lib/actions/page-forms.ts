"use server"

import { revalidatePath } from "next/cache"
import {
  assignDriverToVehicleAction,
  moveActiveDriverToVehicleAction,
  removeDriverFromVehicleAction,
  reassignDriverAction,
} from "@/lib/actions/vehicles"
import {
  endDriverLeaveAction,
  markDriverLeaveAction,
  moveDriverActiveAction,
  moveDriverOffAction,
} from "@/lib/actions/drivers"
import { triggerAutoAllocationAction } from "@/lib/actions/allocations"

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function revalidateFleetPages() {
  revalidatePath("/dashboard")
  revalidatePath("/drivers")
  revalidatePath("/vehicles")
  revalidatePath("/allocations")
}

export type AutoAllocateActionResult = {
  status: "success" | "skipped"
  rotationAssigned: number
  allocated: number
  skipped: number
  message?: string
}

export async function submitAssignDriver(formData: FormData) {
  await assignDriverToVehicleAction({
    vehicleId: textValue(formData, "vehicleId"),
    driverId: textValue(formData, "driverId"),
    notes: textValue(formData, "notes") || undefined,
    effectiveFrom: textValue(formData, "effectiveFrom") || undefined,
  })

  revalidateFleetPages()
}

export async function submitRemoveAllocation(formData: FormData) {
  await removeDriverFromVehicleAction({
    allocationId: textValue(formData, "allocationId"),
    endedReason: textValue(formData, "endedReason") || "manual_remove",
    notes: textValue(formData, "notes") || undefined,
  })

  revalidateFleetPages()
}

export async function submitReassignDriver(formData: FormData) {
  await reassignDriverAction({
    vehicleId: textValue(formData, "vehicleId"),
    newDriverId: textValue(formData, "newDriverId"),
    notes: textValue(formData, "notes") || undefined,
    effectiveFrom: textValue(formData, "effectiveFrom") || undefined,
  })

  revalidateFleetPages()
}

export async function submitMoveDriverVehicle(formData: FormData) {
  await moveActiveDriverToVehicleAction({
    allocationId: textValue(formData, "allocationId"),
    targetVehicleId: textValue(formData, "targetVehicleId"),
    notes: textValue(formData, "notes") || undefined,
    effectiveFrom: textValue(formData, "effectiveFrom") || undefined,
  })

  revalidateFleetPages()
}

export async function submitMoveDriverOff(formData: FormData) {
  await moveDriverOffAction({
    driverId: textValue(formData, "driverId"),
    reasonCode: textValue(formData, "reasonCode") || "manual_off",
    notes: textValue(formData, "notes") || undefined,
  })

  revalidateFleetPages()
}

export async function submitMoveDriverActive(formData: FormData) {
  await moveDriverActiveAction({
    driverId: textValue(formData, "driverId"),
    state: "active",
    notes: textValue(formData, "notes") || undefined,
  })

  revalidateFleetPages()
}

export async function submitMarkDriverLeave(formData: FormData) {
  await markDriverLeaveAction({
    driverId: textValue(formData, "driverId"),
    leaveStart: textValue(formData, "leaveStart"),
    leaveEnd: textValue(formData, "leaveEnd"),
    reason: textValue(formData, "reason") || undefined,
    notes: textValue(formData, "notes") || undefined,
    forceEndAllocation: formData.get("forceEndAllocation") === "on",
  })

  revalidateFleetPages()
}

export async function submitEndDriverLeave(formData: FormData) {
  await endDriverLeaveAction({
    leaveId: textValue(formData, "leaveId"),
    endDate: textValue(formData, "endDate") || undefined,
    notes: textValue(formData, "notes") || undefined,
  })

  revalidateFleetPages()
}

export async function submitAutoAllocate(_prevState?: unknown): Promise<AutoAllocateActionResult> {
  try {
    const result = await triggerAutoAllocationAction()
    revalidateFleetPages()
    return {
      status: result.status,
      rotationAssigned: result.rotationAssigned ?? 0,
      allocated: result.allocated ?? 0,
      skipped: result.skipped ?? 0,
      message:
        (result.allocated ?? 0) === 0 && (result.rotationAssigned ?? 0) === 0
          ? "No eligible allocations were created. Check whether vehicles are unallocated and drivers are allocatable."
          : undefined,
    }
  } catch (error) {
    return {
      status: "skipped" as const,
      rotationAssigned: 0,
      allocated: 0,
      skipped: 0,
      message: error instanceof Error ? error.message : "Auto-allocation failed",
    }
  }
}
