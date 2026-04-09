export type DriverEligibilitySnapshot = {
  current_state: string | null
  current_state_days: number | null
  current_leave_id?: string | null
  current_allocation_id?: string | null
  is_allocatable?: boolean | null
}

export function isDriverEligibleForAllocation(driver: DriverEligibilitySnapshot) {
  if (driver.current_leave_id) return false
  if (driver.current_allocation_id) return false

  const state = String(driver.current_state ?? "").toLowerCase()
  const daysInState = Number(driver.current_state_days ?? 0)

  if (state === "on_leave" || state === "suspended") return false
  if (state === "off") return daysInState >= 7

  return true
}
