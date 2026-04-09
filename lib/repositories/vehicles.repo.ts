import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function listVehiclesRepository(filters: {
  search?: string
  allocated?: boolean
  needsAllocation?: boolean
  branch?: string
  page: number
  pageSize: number
}) {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from("vehiclesc")
    .select("*", { count: "exact" })
    .range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1)
    .order("vehicle_priority", { ascending: false })

  if (filters.search) {
    query = query.or(
      `vehicle_number.ilike.%${filters.search}%,registration_number.ilike.%${filters.search}%,make.ilike.%${filters.search}%,model.ilike.%${filters.search}%`
    )
  }

  if (typeof filters.allocated === "boolean") {
    query = filters.allocated ? query.not("current_allocation_id", "is", null) : query.is("current_allocation_id", null)
  }

  if (typeof filters.needsAllocation === "boolean") {
    query = query.eq("needs_allocation", filters.needsAllocation)
  }

  if (filters.branch) {
    query = query.eq("branch_name", filters.branch)
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

export async function getVehicleDetailsRepository(vehicleId: string) {
  const supabase = createServiceRoleClient()
  const [{ data: vehicle, error }, { data: allocations }, { data: history }] = await Promise.all([
    supabase.from("vehiclesc").select("*").eq("id", vehicleId).single(),
    supabase.from("allocations").select("*").eq("vehicle_id", vehicleId).order("started_at", { ascending: false }),
    supabase.from("allocation_history").select("*").or(`to_vehicle_id.eq.${vehicleId},from_vehicle_id.eq.${vehicleId}`).order("created_at", { ascending: false }),
  ])

  if (error) throw error

  return {
    vehicle,
    allocations: allocations ?? [],
    history: history ?? [],
  }
}
