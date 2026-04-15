import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { writeAuditLog } from "@/lib/services/audit.service"
import { isDriverEligibleForAllocation } from "@/lib/services/allocation-eligibility"
import { finishCronJob, startCronJob } from "@/lib/services/cron.service"
import { recomputeDriverState } from "@/lib/services/driver-state.service"

function shuffleArray<T>(items: T[]) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }

  return copy
}

export async function monitorDriverStates() {
  const run = await startCronJob("monitoring-cron")

  if (!run.started || !run.id) {
    return { status: "skipped" as const }
  }

  const supabase = createServiceRoleClient()

  try {
    const today = new Date().toISOString().slice(0, 10)
    let activatedLeave = 0
    let completedLeave = 0
    let processedDrivers = 0
    let driversMovedOff = 0
    let reallocationsTriggered = 0

    const { data: scheduledLeave, error: scheduledLeaveError } = await supabase
      .from("driver_leave")
      .select("id, driver_id")
      .eq("status", "scheduled")
      .lte("leave_start", today)
      .gte("leave_end", today)

    if (scheduledLeaveError) throw scheduledLeaveError

    for (const leave of scheduledLeave ?? []) {
      const { error } = await supabase
        .from("driver_leave")
        .update({ status: "active" })
        .eq("id", leave.id)
        .eq("status", "scheduled")

      if (!error) {
        await supabase.rpc("upsert_driver_state_tx", {
          p_driver_id: leave.driver_id,
          p_new_state: "on_leave",
          p_reason_code: "leave_started_cron",
          p_note: "Activated by monitoring cron",
          p_actor_user_id: null,
          p_source: "cron",
        })
        activatedLeave++
      }
    }

    const { data: activeLeave, error: activeLeaveError } = await supabase
      .from("driver_leave")
      .select("id, driver_id")
      .eq("status", "active")
      .lt("leave_end", today)

    if (activeLeaveError) throw activeLeaveError

    for (const leave of activeLeave ?? []) {
      const { error } = await supabase
        .from("driver_leave")
        .update({ status: "completed" })
        .eq("id", leave.id)
        .eq("status", "active")

      if (!error) {
        await supabase.rpc("upsert_driver_state_tx", {
          p_driver_id: leave.driver_id,
          p_new_state: "off",
          p_reason_code: "leave_completed_cron",
          p_note: "Completed by monitoring cron",
          p_actor_user_id: null,
          p_source: "cron",
        })
        completedLeave++
      }
    }

    const { data: drivers, error: driversError } = await supabase.from("drivers").select("id")
    if (driversError) throw driversError

    for (const driver of drivers ?? []) {
      await recomputeDriverState(driver.id as string)
      processedDrivers++
    }

    const { data: overdueActiveDrivers, error: overdueActiveDriversError } = await supabase
      .from("drivers")
      .select("id, current_allocation_id")
      .eq("current_state", "active")
      .gte("current_state_days", 33)

    if (overdueActiveDriversError) throw overdueActiveDriversError

    for (const driver of overdueActiveDrivers ?? []) {
      if (driver.current_allocation_id) {
        const { error: removeError } = await supabase.rpc("remove_allocation_tx", {
          p_allocation_id: driver.current_allocation_id,
          p_ended_reason: "state_limit_reached_cron",
          p_notes: "Automatically removed after reaching 33 active days",
          p_actor_user_id: null,
        })

        if (removeError) throw removeError
      }

      const { error: stateError } = await supabase.rpc("upsert_driver_state_tx", {
        p_driver_id: driver.id,
        p_new_state: "off",
        p_reason_code: "state_limit_reached_cron",
        p_note: "Automatically moved off after reaching 33 active days",
        p_actor_user_id: null,
        p_source: "cron",
      })

      if (stateError) throw stateError
      driversMovedOff++
    }

    if (driversMovedOff > 0) {
      const allocationResult = await autoAllocateVehicles()
      if (allocationResult.status === "success") {
        reallocationsTriggered = (allocationResult.allocated ?? 0) + (allocationResult.rotationAssigned ?? 0)
      }
    }

    await finishCronJob(run.id, "success", {
      activatedLeave,
      completedLeave,
      processedDrivers,
      driversMovedOff,
      reallocationsTriggered,
    })

    await writeAuditLog({
      entityType: "cron_job",
      entityId: run.id,
      action: "monitor_driver_states",
      metadata: { activatedLeave, completedLeave, processedDrivers, driversMovedOff, reallocationsTriggered },
    })

    return { status: "success" as const, activatedLeave, completedLeave, processedDrivers, driversMovedOff, reallocationsTriggered }
  } catch (error) {
    await finishCronJob(run.id, "failed", {}, error instanceof Error ? error.message : "Unknown monitoring error")
    throw error
  }
}

export async function autoAllocateVehicles() {
  const run = await startCronJob("allocation-cron")

  if (!run.started || !run.id) {
    return { status: "skipped" as const }
  }

  const supabase = createServiceRoleClient()

  try {
    const today = new Date().toISOString().slice(0, 10)
    let rotationAssigned = 0

    const { data: dueRotations, error: rotationError } = await supabase
      .from("vehicle_rotation_plan_items")
      .select("id, vehicle_id, next_driver_id, proposed_change_date, status")
      .eq("status", "ready")
      .not("vehicle_id", "is", null)
      .not("next_driver_id", "is", null)
      .lte("proposed_change_date", today)
      .order("proposed_change_date", { ascending: true })

    if (rotationError) throw rotationError

    for (const rotation of dueRotations ?? []) {
      const { data: vehicle } = await supabase
        .from("vehiclesc")
        .select("id, current_allocation_id, allocation_locked")
        .eq("id", rotation.vehicle_id)
        .maybeSingle()

      const { data: driver } = await supabase
        .from("drivers")
        .select("id, is_allocatable, current_allocation_id, current_leave_id")
        .eq("id", rotation.next_driver_id)
        .maybeSingle()

      if (!vehicle || !driver || vehicle.allocation_locked || !driver.is_allocatable || driver.current_allocation_id || driver.current_leave_id) {
        await supabase
          .from("vehicle_rotation_plan_items")
          .update({ status: "skipped" })
          .eq("id", rotation.id)
        continue
      }

      if (vehicle.current_allocation_id) {
        const { error } = await supabase.rpc("reassign_driver_tx", {
          p_vehicle_id: vehicle.id,
          p_new_driver_id: driver.id,
          p_effective_from: today,
          p_notes: "Rotation plan auto-reassignment",
          p_actor_user_id: null,
          p_allow_override_locked: false,
        })

        if (error) {
          await supabase.from("vehicle_rotation_plan_items").update({ status: "skipped" }).eq("id", rotation.id)
          continue
        }
      } else {
        const { error } = await supabase.rpc("assign_driver_to_vehicle_tx", {
          p_vehicle_id: vehicle.id,
          p_driver_id: driver.id,
          p_effective_from: today,
          p_notes: "Rotation plan auto-assignment",
          p_actor_user_id: null,
          p_allocation_type: "automatic",
        })

        if (error) {
          await supabase.from("vehicle_rotation_plan_items").update({ status: "skipped" }).eq("id", rotation.id)
          continue
        }
      }

      await supabase
        .from("vehicle_rotation_plan_items")
        .update({ status: "completed" })
        .eq("id", rotation.id)

      rotationAssigned++
    }

    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehiclesc")
      .select("id, vehicle_priority")
      .or("needs_allocation.eq.true,current_allocation_id.is.null")
      .eq("allocation_locked", false)
      .order("vehicle_priority", { ascending: false })

    if (vehiclesError) throw vehiclesError

    let allocated = 0
    let skipped = 0
    const { data: eligibleDrivers, error: eligibleDriversError } = await supabase
      .from("drivers")
      .select("id, current_state, current_state_days, current_leave_id, current_allocation_id, is_allocatable")

    if (eligibleDriversError) throw eligibleDriversError

    const availableDriverIds = shuffleArray(
      (eligibleDrivers ?? [])
        .filter((driver) =>
          isDriverEligibleForAllocation({
            current_state: driver.current_state as string | null,
            current_state_days: Number(driver.current_state_days ?? 0),
            current_leave_id: driver.current_leave_id as string | null,
            current_allocation_id: driver.current_allocation_id as string | null,
            is_allocatable: driver.is_allocatable as boolean | null,
          })
        )
        .map((driver) => driver.id as string)
    )

    for (const vehicle of vehicles ?? []) {
      const candidateId = availableDriverIds.shift()

      if (!candidateId) {
        skipped++
        continue
      }

      const { error } = await supabase.rpc("assign_driver_to_vehicle_tx", {
        p_vehicle_id: vehicle.id,
        p_driver_id: candidateId,
        p_effective_from: today,
        p_notes: "Auto-allocation random assignment",
        p_actor_user_id: null,
        p_allocation_type: "automatic",
      })

      if (error) {
        skipped++
        continue
      }

      allocated++
    }

    await finishCronJob(run.id, "success", { rotationAssigned, allocated, skipped })

    await writeAuditLog({
      entityType: "cron_job",
      entityId: run.id,
      action: "auto_allocate_vehicles",
      metadata: { rotationAssigned, allocated, skipped },
    })

    return { status: "success" as const, rotationAssigned, allocated, skipped }
  } catch (error) {
    await finishCronJob(run.id, "failed", {}, error instanceof Error ? error.message : "Unknown allocation error")
    throw error
  }
}
