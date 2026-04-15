import { AppLayout } from "@/components/app-sidebar"
import { DashboardSevenDayView } from "@/components/dashboard-seven-day-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireRole } from "@/lib/auth/guards"
import { getDashboardSummaryRepository } from "@/lib/repositories/dashboard.repo"
import { submitMoveDriverActive, submitMoveDriverOff, submitMoveDriverVehicle, submitReassignDriver } from "@/lib/actions/page-forms"
import { AlertTriangle, CheckCircle2, FileWarning, Truck, Users } from "lucide-react"
import Link from "next/link"

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A"
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(value))
}

function stateDaysLabel(state: string, days: number) {
  if (state === "active") {
    return `${days} day${days === 1 ? "" : "s"} on`
  }

  if (state === "off") {
    return `${days} day${days === 1 ? "" : "s"} off`
  }

  if (state === "inactive") {
    return `${days} day${days === 1 ? "" : "s"} inactive`
  }

  return `${days} day${days === 1 ? "" : "s"}`
}

function activeThresholdRow(days: number) {
  if (days > 33) return "bg-red-50/90"
  if (days >= 30 && days < 33) return "bg-amber-50/90"
  return ""
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ panel?: string; view?: string }> | { panel?: string; view?: string }
}) {
  await requireRole(["admin", "dispatcher", "viewer"])
  const resolvedSearchParams = await searchParams
  const { summary, activeDriverBoard, offDriverBoard, replacementDriverPool, openVehiclePool, expiryAlerts } = await getDashboardSummaryRepository()

  const totalDrivers = summary?.total_drivers ?? 0
  const activeDrivers = summary?.active_drivers ?? 0
  const inactiveDrivers = summary?.inactive_drivers ?? 0
  const onLeaveDrivers = summary?.on_leave_drivers ?? 0
  const totalVehicles = summary?.total_vehicles ?? 0
  const allocatedVehicles = summary?.allocated_vehicles ?? 0
  const unallocatedVehicles = summary?.unallocated_vehicles ?? 0
  const warningDrivers = summary?.warning_drivers ?? 0
  const criticalDrivers = summary?.critical_drivers ?? 0
  const utilization = totalVehicles > 0 ? Math.round((allocatedVehicles / totalVehicles) * 100) : 0
  const currentPanel = resolvedSearchParams?.panel === "vehicles" ? "vehicles" : "drivers"
  const isVehiclePanelOpen = resolvedSearchParams?.panel === "vehicles"
  const currentView = resolvedSearchParams?.view === "seven-day" ? "seven-day" : "dashboard"
  const driverPanelHref = currentView === "seven-day" ? "/dashboard?panel=drivers&view=seven-day" : "/dashboard?panel=drivers"
  const vehiclePanelHref = currentView === "seven-day" ? "/dashboard?panel=vehicles&view=seven-day" : "/dashboard?panel=vehicles"
  const activeVehicleBoard = activeDriverBoard
    .filter((driver) => driver.current_vehicle)
    .map((driver) => ({
      id: String(driver.current_vehicle_id ?? driver.id),
      vehicleNumber: driver.current_vehicle?.vehicle_number ?? "Unknown vehicle",
      registrationNumber: driver.current_vehicle?.registration_number ?? "No reg",
      driverName: `${driver.first_name} ${driver.surname}`,
      driverCode: driver.driver_code,
      daysOn: Number(driver.current_state_days ?? 0),
    }))
    .sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber))

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Fleet Overview</h1>
          <p className="text-muted-foreground">Live backend metrics, compliance alerts, and recent allocation activity.</p>
        </div>

        <Tabs defaultValue={currentView} className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="seven-day">7 Day View</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link
            href={driverPanelHref}
            className="block"
          >
            <Card className={`border-0 ${currentPanel === "drivers" ? "bg-primary text-primary-foreground" : "bg-primary/90 text-primary-foreground hover:bg-primary"}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-medium tracking-wide opacity-80">DRIVERS</span>
                </div>
                <p className="text-4xl font-bold mb-1">{totalDrivers}</p>
                <p className="text-sm opacity-80">{activeDrivers} active, {inactiveDrivers + onLeaveDrivers} not active</p>
                {currentPanel === "vehicles" ? (
                  <p className="mt-2 text-xs opacity-80">Click to switch back to driver view</p>
                ) : null}
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-xs font-medium tracking-wide text-muted-foreground">UTILIZATION</span>
              </div>
              <p className="text-4xl font-bold text-foreground mb-1">{utilization}%</p>
              <p className="text-sm text-muted-foreground">{allocatedVehicles} of {totalVehicles} vehicles allocated</p>
            </CardContent>
          </Card>

          <Link
            href={vehiclePanelHref}
            className="block"
          >
            <Card
              className={`border-0 ${
                isVehiclePanelOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground hover:border-primary/20 hover:bg-accent/20"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className={`w-5 h-5 ${isVehiclePanelOpen ? "text-primary-foreground" : "text-amber-500"}`} />
                  <span className={`text-xs font-medium tracking-wide ${isVehiclePanelOpen ? "opacity-80" : "text-muted-foreground"}`}>VEHICLES</span>
                </div>
                <p className={`text-4xl font-bold mb-1 ${isVehiclePanelOpen ? "text-primary-foreground" : "text-foreground"}`}>{totalVehicles}</p>
                <p className={`text-sm ${isVehiclePanelOpen ? "opacity-80" : "text-muted-foreground"}`}>{unallocatedVehicles} currently need allocation</p>
                <p className={`mt-2 text-xs ${isVehiclePanelOpen ? "opacity-80" : "text-muted-foreground"}`}>
                  {isVehiclePanelOpen ? "Click to hide active vehicle board" : "Click to view active vehicles and assigned drivers"}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-xs font-medium tracking-wide text-muted-foreground">STATE LIMITS</span>
              </div>
              <p className="text-4xl font-bold text-foreground mb-1">{warningDrivers + criticalDrivers}</p>
              <p className="text-sm text-muted-foreground">{criticalDrivers} critical, {warningDrivers} warning</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {isVehiclePanelOpen ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Vehicles With Drivers</CardTitle>
                    <Badge variant="outline">{activeVehicleBoard.length} total</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeVehicleBoard.length === 0 ? (
                    <p className="text-sm text-muted-foreground">There are no active vehicle allocations to show right now.</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full table-fixed">
                        <thead className="bg-secondary/40">
                          <tr className="border-b border-border">
                            <th className="w-[26%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Vehicle</th>
                            <th className="w-[22%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Registration</th>
                            <th className="w-[32%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Driver</th>
                            <th className="w-[20%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Days On</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeVehicleBoard.map((vehicle) => (
                            <tr key={vehicle.id} className={`border-b border-border last:border-0 ${activeThresholdRow(vehicle.daysOn)}`}>
                              <td className="py-3 px-3 text-sm font-medium text-foreground">{vehicle.vehicleNumber}</td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">{vehicle.registrationNumber}</td>
                              <td className="py-3 px-3">
                                <div className="text-sm font-medium text-foreground">{vehicle.driverName}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Code {vehicle.driverCode}</div>
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">{stateDaysLabel("active", vehicle.daysOn)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Vehicles Without Drivers</CardTitle>
                    <Badge variant="outline">{openVehiclePool.length} total</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {openVehiclePool.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All vehicles are currently allocated.</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full table-fixed">
                        <thead className="bg-secondary/40">
                          <tr className="border-b border-border">
                            <th className="w-[34%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Vehicle</th>
                            <th className="w-[34%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Registration</th>
                            <th className="w-[32%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openVehiclePool.map((vehicle) => (
                            <tr key={String(vehicle.id)} className="border-b border-border last:border-0">
                              <td className="py-3 px-3 text-sm font-medium text-foreground">{vehicle.vehicle_number ?? "Unknown vehicle"}</td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">{vehicle.registration_number ?? "No reg"}</td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">Open for allocation</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle>Active Drivers</CardTitle>
                      <Badge variant="outline">{activeDriverBoard.length} total</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full table-fixed">
                        <thead className="bg-secondary/40">
                          <tr className="border-b border-border">
                            <th className="w-[16%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Code</th>
                            <th className="w-[58%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Driver</th>
                            <th className="w-[26%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Days On</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDriverBoard.map((driver) => {
                            const replacementOptions = replacementDriverPool.filter((candidate) => candidate.id !== driver.id)
                            const targetVehicleOptions = openVehiclePool.filter((vehicle) => vehicle.id !== driver.current_vehicle_id)

                            return (
                              <tr
                                key={driver.id as string}
                                className={`border-b border-border last:border-0 align-top ${activeThresholdRow(Number(driver.current_state_days ?? 0))}`}
                              >
                                <td className="py-1.5 px-3 text-sm font-medium text-foreground align-top break-words">{driver.driver_code}</td>
                                <td className="py-1.5 px-3 align-top">
                                  <div className="break-words text-sm text-foreground">{driver.first_name} {driver.surname}</div>
                                  {driver.current_vehicle ? (
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      {driver.current_vehicle.vehicle_number} - {driver.current_vehicle.registration_number ?? "No reg"}
                                    </div>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <form action={submitMoveDriverOff}>
                                      <input type="hidden" name="driverId" value={String(driver.id)} />
                                      <input type="hidden" name="reasonCode" value="dashboard_move_off" />
                                      <Button type="submit" size="sm" variant="outline" className="h-7 px-2.5 text-xs">Move Off</Button>
                                    </form>
                                    {driver.current_vehicle_id ? (
                                      <>
                                        <form action={submitReassignDriver} className="flex items-center gap-1.5">
                                          <input type="hidden" name="vehicleId" value={String(driver.current_vehicle_id)} />
                                          <select
                                            name="newDriverId"
                                            className="h-7 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
                                            required
                                            defaultValue=""
                                            disabled={replacementOptions.length === 0}
                                          >
                                            <option value="" disabled>
                                              {replacementOptions.length === 0 ? "No eligible replacements" : "Select replacement"}
                                            </option>
                                            {replacementOptions.map((candidate) => (
                                              <option key={candidate.id as string} value={String(candidate.id)}>
                                                {candidate.driver_code} - {candidate.first_name} {candidate.surname}
                                              </option>
                                            ))}
                                          </select>
                                          <Button type="submit" size="sm" className="h-7 px-2.5 text-xs" disabled={replacementOptions.length === 0}>
                                            Exchange
                                          </Button>
                                        </form>
                                        <form action={submitMoveDriverVehicle} className="flex items-center gap-1.5">
                                          <input type="hidden" name="allocationId" value={String(driver.current_allocation_id)} />
                                          <select
                                            name="targetVehicleId"
                                            className="h-7 min-w-[160px] rounded-md border border-input bg-background px-2 text-xs"
                                            required
                                            defaultValue=""
                                            disabled={targetVehicleOptions.length === 0}
                                          >
                                            <option value="" disabled>
                                              {targetVehicleOptions.length === 0 ? "No open vehicles" : "Select vehicle"}
                                            </option>
                                            {targetVehicleOptions.map((vehicle) => (
                                              <option key={vehicle.id as string} value={String(vehicle.id)}>
                                                {vehicle.vehicle_number} - {vehicle.registration_number ?? "No reg"}
                                              </option>
                                            ))}
                                          </select>
                                          <Button type="submit" size="sm" variant="secondary" className="h-7 px-2.5 text-xs" disabled={targetVehicleOptions.length === 0}>
                                            Move Vehicle
                                          </Button>
                                        </form>
                                      </>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-1.5 px-3 text-sm text-muted-foreground align-top">{stateDaysLabel("active", Number(driver.current_state_days ?? 0))}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle>Inactive / Off Drivers</CardTitle>
                      <Badge variant="outline">{offDriverBoard.length} total</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full table-fixed">
                        <thead className="bg-secondary/40">
                          <tr className="border-b border-border">
                            <th className="w-[14%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Code</th>
                            <th className="w-[42%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Driver</th>
                            <th className="w-[18%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Days Off</th>
                            <th className="w-[26%] text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offDriverBoard.map((driver) => (
                            <tr key={driver.id as string} className="border-b border-border last:border-0 align-top">
                              <td className="py-2 px-3 text-sm font-medium text-foreground align-top break-words">{driver.driver_code}</td>
                              <td className="py-2 px-3 text-sm text-foreground align-top break-words">{driver.first_name} {driver.surname}</td>
                              <td className="py-2 px-3 text-sm text-muted-foreground align-top">
                                {stateDaysLabel(String(driver.current_state), Number(driver.current_state_days ?? 0))}
                              </td>
                              <td className="py-2 px-3">
                                <form action={submitMoveDriverActive}>
                                  <input type="hidden" name="driverId" value={String(driver.id)} />
                                  <Button type="submit" size="sm" className="h-8 w-full whitespace-nowrap px-3 text-xs">Move Active</Button>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Compliance Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-700">{criticalDrivers} drivers are above the 33-day threshold</p>
                    <p className="text-xs text-red-600 mt-1">These drivers should be pulled off or replaced immediately.</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-700">{warningDrivers} drivers are above 30 days</p>
                    <p className="text-xs text-amber-600 mt-1">These drivers are approaching critical reassignment status.</p>
                  </div>

                  <div className="space-y-2">
                    {expiryAlerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No upcoming licence or PDP alerts.</p>
                    ) : (
                      expiryAlerts.slice(0, 8).map((driver) => (
                        <div key={driver.id as string} className="rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2">
                            <FileWarning className="w-4 h-4 text-amber-600" />
                            <p className="text-sm font-medium text-foreground">
                              {driver.first_name} {driver.surname}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">Code {driver.driver_code}</Badge>
                            <span>License: {formatDate(driver.license_expiry_date as string | null)}</span>
                            <span>PDP: {formatDate(driver.pdp_expiry_date as string | null)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
          </TabsContent>

          <TabsContent value="seven-day">
            <DashboardSevenDayView activeDriverBoard={activeDriverBoard} offDriverBoard={offDriverBoard} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
