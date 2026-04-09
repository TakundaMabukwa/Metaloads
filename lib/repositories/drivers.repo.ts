import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function listDriversRepository(filters: {
  search?: string
  state?: string
  warningLevel?: string
  available?: boolean
  page: number
  pageSize: number
}) {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from("v_driver_live_status")
    .select("*", { count: "exact" })
    .range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1)
    .order("surname", { ascending: true })

  if (filters.search) {
    query = query.or(
      `driver_code.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,surname.ilike.%${filters.search}%`
    )
  }

  if (filters.state) {
    query = query.eq("current_state", filters.state)
  }

  if (filters.warningLevel) {
    query = query.eq("warning_level", filters.warningLevel)
  }

  if (typeof filters.available === "boolean") {
    query = query.eq("available", filters.available)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    rows: data ?? [],
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }
}

export async function getDriverDetailsRepository(driverId: string) {
  const supabase = createServiceRoleClient()

  const [{ data: driver, error }, { data: leave }, { data: stateHistory }, { data: allocations }] =
    await Promise.all([
      supabase.from("drivers").select("*").eq("id", driverId).single(),
      supabase.from("driver_leave").select("*").eq("driver_id", driverId).order("leave_start", { ascending: false }),
      supabase.from("driver_state_history").select("*").eq("driver_id", driverId).order("effective_from", { ascending: false }),
      supabase.from("allocations").select("*").eq("driver_id", driverId).order("started_at", { ascending: false }),
    ])

  if (error) throw error

  return {
    driver,
    leave: leave ?? [],
    stateHistory: stateHistory ?? [],
    allocations: allocations ?? [],
  }
}
