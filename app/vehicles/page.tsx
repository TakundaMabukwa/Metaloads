import { AppLayout } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VehicleFormModal } from "@/components/vehicle-form-modal"
import { requireRole } from "@/lib/auth/guards"
import { listVehiclesRepository } from "@/lib/repositories/vehicles.repo"
import { createServerSupabaseClient } from "@/lib/supabase/server"

function tone(needsAllocation: boolean, locked: boolean) {
  if (locked) return "bg-amber-50 text-amber-700 border-amber-200"
  if (needsAllocation) return "bg-red-50 text-red-700 border-red-200"
  return "bg-emerald-50 text-emerald-700 border-emerald-200"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A"
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(value))
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null
  const target = new Date(value)
  const today = new Date()
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((utcTarget - utcToday) / (1000 * 60 * 60 * 24))
}

function expiryTone(days: number | null) {
  if (days === null) return "bg-slate-50 text-slate-600 border-slate-200"
  if (days < 0) return "bg-red-50 text-red-700 border-red-200"
  if (days <= 30) return "bg-amber-50 text-amber-700 border-amber-200"
  if (days <= 60) return "bg-orange-50 text-orange-700 border-orange-200"
  return "bg-emerald-50 text-emerald-700 border-emerald-200"
}

function expiryLabel(days: number | null) {
  if (days === null) return "No expiry date"
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
  if (days === 0) return "Expires today"
  return `${days} day${days === 1 ? "" : "s"} left`
}

export default async function VehiclesPage() {
  await requireRole(["admin", "dispatcher", "viewer"])
  const { rows } = await listVehiclesRepository({ page: 1, pageSize: 150 })
  const supabase = await createServerSupabaseClient()
  const selectedVehicle = rows[0] ?? null

  const allocationLookupIds = rows
    .map((row) => row.current_driver_id as string | null)
    .filter((value): value is string => Boolean(value))

  const { data: drivers } = allocationLookupIds.length
    ? await supabase
        .from("drivers")
        .select("id, driver_code, first_name, surname, current_state")
        .in("id", allocationLookupIds)
    : { data: [] }

  const driversById = new Map((drivers ?? []).map((row) => [row.id as string, row]))
  const selectedDriver = selectedVehicle?.current_driver_id
    ? driversById.get(selectedVehicle.current_driver_id as string)
    : null
  const vehicleExpiryAnalysis = rows
    .map((vehicle) => ({
      id: vehicle.id as string,
      vehicle_number: vehicle.vehicle_number as string | null,
      registration_number: vehicle.registration_number as string | null,
      license_expiry_date: vehicle.license_expiry_date as string | null | undefined,
      expiryDays: daysUntil(vehicle.license_expiry_date as string | null | undefined),
    }))
    .sort((a, b) => {
      const aDays = a.expiryDays ?? Number.POSITIVE_INFINITY
      const bDays = b.expiryDays ?? Number.POSITIVE_INFINITY
      return aDays - bDays
    })

  const vehicleOverdue = vehicleExpiryAnalysis.filter((vehicle) => vehicle.expiryDays !== null && vehicle.expiryDays < 0).length
  const vehicle30Days = vehicleExpiryAnalysis.filter((vehicle) => vehicle.expiryDays !== null && vehicle.expiryDays >= 0 && vehicle.expiryDays <= 30).length
  const vehicle60Days = vehicleExpiryAnalysis.filter((vehicle) => vehicle.expiryDays !== null && vehicle.expiryDays > 30 && vehicle.expiryDays <= 60).length

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Fleet Inventory</h1>
            <p className="text-muted-foreground">Live vehicle master data, assignment status, and operational readiness.</p>
            <p className="mt-2 text-sm text-muted-foreground">{rows.length} vehicles loaded from the fleet register.</p>
          </div>
          <VehicleFormModal triggerLabel="Add Vehicle" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle License Overdue</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{vehicleOverdue}</p>
              <p className="text-sm text-muted-foreground">Vehicles with expired license discs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle License 0-30 Days</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{vehicle30Days}</p>
              <p className="text-sm text-muted-foreground">Vehicles expiring within the next 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle License 31-60 Days</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">{vehicle60Days}</p>
              <p className="text-sm text-muted-foreground">Vehicles with medium-term expiry risk</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle License Age Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicleExpiryAnalysis.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicle expiry data is available yet.</p>
            ) : (
              vehicleExpiryAnalysis.slice(0, 12).map((vehicle) => (
                <div key={vehicle.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{vehicle.vehicle_number ?? "Unknown vehicle"}</p>
                    <p className="text-xs text-muted-foreground">{vehicle.registration_number ?? "No registration"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className={expiryTone(vehicle.expiryDays)}>
                      {expiryLabel(vehicle.expiryDays)}
                    </Badge>
                    <span className="text-muted-foreground">{formatDate(vehicle.license_expiry_date)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Register</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles have been imported yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Vehicle</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Registration</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Assignment</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Priority</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((vehicle) => {
                        const driver = vehicle.current_driver_id
                          ? driversById.get(vehicle.current_driver_id as string)
                          : null

                        return (
                          <tr key={vehicle.id as string} className="border-b border-border last:border-0">
                            <td className="py-3 pr-3">
                              <p className="text-sm font-medium text-foreground">{vehicle.vehicle_number ?? "Unknown unit"}</p>
                              <p className="text-xs text-muted-foreground">{vehicle.display_label ?? vehicle.model ?? "No display label"}</p>
                            </td>
                            <td className="py-3 pr-3 text-sm text-foreground">{vehicle.registration_number ?? "N/A"}</td>
                            <td className="py-3 pr-3">
                              <p className="text-sm text-foreground">{vehicle.vehicle_type ?? vehicle.make ?? "Unspecified"}</p>
                              <p className="text-xs text-muted-foreground">{vehicle.make ?? "Unknown make"}</p>
                            </td>
                            <td className="py-3 pr-3">
                              {driver ? (
                                <div>
                                  <p className="text-sm font-medium text-foreground">{driver.first_name} {driver.surname}</p>
                                  <p className="text-xs text-muted-foreground">{driver.driver_code}</p>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unallocated</span>
                              )}
                            </td>
                            <td className="py-3 pr-3 text-sm text-foreground">{vehicle.vehicle_priority ?? "-"}</td>
                            <td className="py-3 pr-3">
                              <Badge variant="outline" className={tone(Boolean(vehicle.needs_allocation), Boolean(vehicle.allocation_locked))}>
                                {vehicle.allocation_locked
                                  ? "Locked"
                                  : vehicle.needs_allocation
                                  ? "Needs allocation"
                                  : "Allocated"}
                              </Badge>
                            </td>
                            <td className="py-3">
                              <VehicleFormModal
                                triggerLabel="Edit"
                                triggerVariant="secondary"
                                vehicle={{
                                  id: String(vehicle.id),
                                  vehicle_number: vehicle.vehicle_number as string | null,
                                  registration_number: vehicle.registration_number as string | null,
                                  display_label: vehicle.display_label as string | null,
                                  make: vehicle.make as string | null,
                                  model: vehicle.model as string | null,
                                  vehicle_type: vehicle.vehicle_type as string | null,
                                  vin_number: vehicle.vin_number as string | null,
                                  trailer_1_registration: vehicle.trailer_1_registration as string | null,
                                  trailer_2_registration: vehicle.trailer_2_registration as string | null,
                                  branch_name: vehicle.branch_name as string | null,
                                  dekra_service_status: vehicle.dekra_service_status as string | null,
                                  license_expiry_date: vehicle.license_expiry_date as string | null,
                                  vehicle_priority: vehicle.vehicle_priority as number | null,
                                  status: vehicle.status as string | null,
                                  needs_allocation: vehicle.needs_allocation as boolean | null,
                                  allocation_locked: vehicle.allocation_locked as boolean | null,
                                }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vehicle Spotlight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedVehicle ? (
                <p className="text-sm text-muted-foreground">No vehicle details are available yet.</p>
              ) : (
                <>
                  <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
                    <p className="text-sm opacity-80">Selected Vehicle</p>
                    <p className="mt-1 text-2xl font-semibold">{selectedVehicle.vehicle_number ?? "Unknown"}</p>
                    <p className="text-sm opacity-80">{selectedVehicle.registration_number ?? "No registration"}</p>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Display Label</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{selectedVehicle.display_label ?? "N/A"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Compliance</p>
                      <p className="mt-1 text-sm text-foreground">VIN: {selectedVehicle.vin_number ?? "N/A"}</p>
                      <p className="text-sm text-foreground">License expiry: {selectedVehicle.license_expiry_date ?? "N/A"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Trailers</p>
                      <p className="mt-1 text-sm text-foreground">Trailer 1: {selectedVehicle.trailer_1_registration ?? "N/A"}</p>
                      <p className="text-sm text-foreground">Trailer 2: {selectedVehicle.trailer_2_registration ?? "N/A"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Current Driver</p>
                      {selectedDriver ? (
                        <>
                          <p className="mt-1 text-sm font-medium text-foreground">{selectedDriver.first_name} {selectedDriver.surname}</p>
                          <p className="text-xs text-muted-foreground">{selectedDriver.driver_code} · {selectedDriver.current_state}</p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">No active driver assigned.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
