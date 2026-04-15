import { AppLayout } from "@/components/app-sidebar"
import { AutoAllocateButton } from "@/components/auto-allocate-button"
import { MoveDriverActiveButton } from "@/components/move-driver-active-button"
import { RemoveAllocationButton } from "@/components/remove-allocation-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth/guards"
import {
  submitAssignDriver,
  submitMoveDriverOff,
  submitMoveDriverVehicle,
} from "@/lib/actions/page-forms"
import { getAllocationsWorkspaceRepository } from "@/lib/repositories/allocations.repo"
import { CheckCircle2, Truck, Users } from "lucide-react"

function stateBadge(state: string) {
  switch (state) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "on_leave":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "inactive":
      return "bg-slate-100 text-slate-700 border-slate-200"
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-blue-50 text-blue-700 border-blue-200"
  }
}

function stateDurationLabel(state: string, days: number) {
  const normalizedState = state.toLowerCase()

  if (normalizedState === "active") {
    return `${days} day${days === 1 ? "" : "s"} on`
  }

  if (normalizedState === "off") {
    return `${days} day${days === 1 ? "" : "s"} off`
  }

  if (normalizedState === "on_leave") {
    return `${days} day${days === 1 ? "" : "s"} on leave`
  }

  return `${days} day${days === 1 ? "" : "s"} in state`
}

function activeThresholdHighlight(days: number) {
  if (days > 33) return "border-red-200 bg-red-50/80"
  if (days >= 30 && days < 33) return "border-amber-200 bg-amber-50/80"
  return ""
}

export default async function AllocationsPage() {
  await requireRole(["admin", "dispatcher", "viewer"])
  const {
    vehiclesNeedingAllocation,
    allocatableDrivers,
    inactiveDrivers,
    activeAllocations,
    recentHistory,
  } = await getAllocationsWorkspaceRepository()

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Operational Workspace</h1>
            <p className="text-muted-foreground">Allocate vehicles, move drivers between states, and trigger auto-allocation.</p>
          </div>
          <AutoAllocateButton />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Drivers Off / Inactive / Leave
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inactiveDrivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No off, inactive, leave, or suspended drivers right now.</p>
              ) : (
                inactiveDrivers.slice(0, 20).map((driver) => (
                  <div key={driver.id as string} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{driver.first_name} {driver.surname}</p>
                      <p className="text-xs text-muted-foreground">{driver.driver_code} - {stateDurationLabel(String(driver.current_state), Number(driver.current_state_days ?? 0))}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={stateBadge(String(driver.current_state))}>
                        {String(driver.current_state).replace("_", " ")}
                      </Badge>
                       <MoveDriverActiveButton driverId={String(driver.id)} />
                      <form action={submitMoveDriverOff}>
                        <input type="hidden" name="driverId" value={String(driver.id)} />
                        <input type="hidden" name="reasonCode" value="manual_off" />
                        <Button type="submit" size="sm" variant="outline">Keep Off</Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                Live Allocations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeAllocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active allocations exist yet.</p>
              ) : (
                activeAllocations.map((allocation) => (
                  <div
                    key={allocation.id as string}
                    className={`rounded-lg border border-border p-4 ${activeThresholdHighlight(Number(allocation.driver?.current_state_days ?? 0))}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {allocation.vehicle?.vehicle_number ?? "Unknown vehicle"} {"->"} {allocation.driver?.first_name ?? "Unknown"} {allocation.driver?.surname ?? ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {allocation.vehicle?.registration_number ?? "No reg"} · {allocation.driver?.driver_code ?? "No code"} · {allocation.status}
                        </p>
                      </div>

                      <div className="flex min-w-[320px] flex-col gap-2 lg:max-w-[360px]">
                        <div className="flex justify-start lg:justify-end">
                          <Badge variant="outline" className={stateBadge(String(allocation.driver?.current_state ?? "off"))}>
                            {allocation.driver?.current_state ?? "unknown"}
                          </Badge>
                        </div>

                        <form action={submitMoveDriverVehicle} className="flex flex-col gap-2 sm:flex-row">
                          <input type="hidden" name="allocationId" value={String(allocation.id)} />
                          <select
                            name="targetVehicleId"
                            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                            required
                            defaultValue=""
                          >
                            <option value="" disabled>Move to vehicle</option>
                            {vehiclesNeedingAllocation.map((vehicle) => (
                              <option key={vehicle.id as string} value={String(vehicle.id)}>
                                {vehicle.vehicle_number} - {vehicle.registration_number ?? "No reg"}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" variant="secondary" className="h-9 whitespace-nowrap px-4">
                            Move Vehicle
                          </Button>
                        </form>

                        <RemoveAllocationButton allocationId={String(allocation.id)} endedReason="manual_remove" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-muted-foreground" />
                Vehicles Needing Allocation
              </CardTitle>
              <Badge variant="outline">{vehiclesNeedingAllocation.length} pending</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehiclesNeedingAllocation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every vehicle currently has an allocation or is not marked as needing one.</p>
            ) : (
              vehiclesNeedingAllocation.map((vehicle) => (
                <div key={vehicle.id as string} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{vehicle.vehicle_number ?? "Unknown vehicle"}</p>
                      <p className="text-sm text-muted-foreground">
                        {vehicle.registration_number ?? "No registration"} · {vehicle.make ?? "Unknown make"} {vehicle.model ?? ""}
                      </p>
                    </div>

                    <form action={submitAssignDriver} className="flex flex-col gap-2 xl:flex-row xl:items-center">
                      <input type="hidden" name="vehicleId" value={String(vehicle.id)} />
                      <input type="date" name="effectiveFrom" className="h-9 rounded-md border border-input px-3 text-sm" />
                      <select name="driverId" className="h-9 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm" required defaultValue="">
                        <option value="" disabled>Select an allocatable driver</option>
                        {allocatableDrivers.map((driver) => (
                          <option key={driver.id as string} value={String(driver.id)}>
                            {driver.driver_code} - {driver.first_name} {driver.surname} - {stateDurationLabel(String(driver.current_state), Number(driver.current_state_days ?? 0))}
                          </option>
                        ))}
                      </select>
                      <input type="text" name="notes" placeholder="Notes" className="h-9 rounded-md border border-input px-3 text-sm" />
                      <Button type="submit">Assign Driver</Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Allocation History</CardTitle>
          </CardHeader>
          <CardContent>
            {recentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allocation history events yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Event</th>
                      <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Driver</th>
                      <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Vehicle</th>
                      <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentHistory.map((item) => (
                      <tr key={item.id as string} className="border-b border-border last:border-0">
                        <td className="py-3 pr-3 text-sm font-medium text-foreground">{String(item.event_type).replace(/_/g, " ")}</td>
                        <td className="py-3 pr-3 text-sm text-muted-foreground">{item.to_driver_id ?? item.from_driver_id ?? "N/A"}</td>
                        <td className="py-3 pr-3 text-sm text-muted-foreground">{item.to_vehicle_id ?? item.from_vehicle_id ?? "N/A"}</td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at as string))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
