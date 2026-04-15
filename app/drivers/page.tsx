import { AppLayout } from "@/components/app-sidebar"
import { DriverFormModal } from "@/components/driver-form-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth/guards"
import { submitEndDriverLeave, submitMarkDriverLeave, submitMoveDriverActive, submitMoveDriverOff } from "@/lib/actions/page-forms"
import { listDriversRepository } from "@/lib/repositories/drivers.repo"
import { createServerSupabaseClient } from "@/lib/supabase/server"

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A"
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(value))
}

function statusTone(state: string) {
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

function warningTone(level: string) {
  switch (level) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200"
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200"
    default:
      return "bg-slate-50 text-slate-600 border-slate-200"
  }
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

export default async function DriversPage() {
  await requireRole(["admin", "dispatcher", "viewer"])
  const { rows } = await listDriversRepository({ page: 1, pageSize: 100 })
  const supabase = await createServerSupabaseClient()

  const driverIds = rows.map((row) => row.id as string)
  const leaveQueryResult = driverIds.length
    ? await supabase
        .from("driver_leave")
        .select("id, driver_id, leave_start, leave_end, status, reason")
        .in("driver_id", driverIds)
        .in("status", ["scheduled", "active"])
        .order("leave_start", { ascending: false })
    : { data: [] }

  const activeLeave = leaveQueryResult.data ?? []
  const leaveByDriverId = new Map<string, (typeof activeLeave)[number]>()
  for (const leave of activeLeave) {
    if (!leaveByDriverId.has(leave.driver_id as string)) {
      leaveByDriverId.set(leave.driver_id as string, leave)
    }
  }

  const complianceRows = driverIds.length
    ? await supabase
        .from("drivers")
        .select("id, driver_code, employee_number, first_name, surname, display_name, cell_number, email_address, license_number, license_expiry_date, pdp_expiry_date, passport_expiry, training_last_done, current_state, available, is_allocatable")
        .in("id", driverIds)
    : { data: [] }

  const complianceByDriverId = new Map((complianceRows.data ?? []).map((row) => [row.id as string, row]))
  const editorByDriverId = new Map((complianceRows.data ?? []).map((row) => [row.id as string, row]))
  const driverExpiryAnalysis = rows
    .map((driver) => {
      const compliance = complianceByDriverId.get(driver.id as string)
      const licenseDays = daysUntil(compliance?.license_expiry_date as string | null | undefined)
      const pdpDays = daysUntil(compliance?.pdp_expiry_date as string | null | undefined)
      return {
        id: driver.id as string,
        driver_code: driver.driver_code as string,
        first_name: driver.first_name as string,
        surname: driver.surname as string,
        license_expiry_date: compliance?.license_expiry_date as string | null | undefined,
        pdp_expiry_date: compliance?.pdp_expiry_date as string | null | undefined,
        licenseDays,
        pdpDays,
      }
    })
    .sort((a, b) => {
      const aDays = a.licenseDays ?? Number.POSITIVE_INFINITY
      const bDays = b.licenseDays ?? Number.POSITIVE_INFINITY
      return aDays - bDays
    })

  const licenseOverdue = driverExpiryAnalysis.filter((driver) => driver.licenseDays !== null && driver.licenseDays < 0).length
  const license30Days = driverExpiryAnalysis.filter((driver) => driver.licenseDays !== null && driver.licenseDays >= 0 && driver.licenseDays <= 30).length
  const license60Days = driverExpiryAnalysis.filter((driver) => driver.licenseDays !== null && driver.licenseDays > 30 && driver.licenseDays <= 60).length
  const pdpOverdue = driverExpiryAnalysis.filter((driver) => driver.pdpDays !== null && driver.pdpDays < 0).length

  const selectedDriver = rows[0] ?? null
  const selectedDriverLeave = selectedDriver ? leaveByDriverId.get(selectedDriver.id as string) : null

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Drivers Directory</h1>
            <p className="text-muted-foreground">Live driver status, leave management, and state transition controls.</p>
          </div>
          <DriverFormModal triggerLabel="Add Driver" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">License Overdue</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{licenseOverdue}</p>
              <p className="text-sm text-muted-foreground">Drivers whose license has already expired</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">License 0-30 Days</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{license30Days}</p>
              <p className="text-sm text-muted-foreground">Drivers approaching expiry within 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">License 31-60 Days</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">{license60Days}</p>
              <p className="text-sm text-muted-foreground">Drivers with medium-term expiry risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">PDP Overdue</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{pdpOverdue}</p>
              <p className="text-sm text-muted-foreground">Drivers needing immediate PDP attention</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>License Age Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {driverExpiryAnalysis.length === 0 ? (
              <p className="text-sm text-muted-foreground">No driver compliance data is available yet.</p>
            ) : (
              driverExpiryAnalysis.slice(0, 12).map((driver) => (
                <div key={driver.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{driver.first_name} {driver.surname}</p>
                    <p className="text-xs text-muted-foreground">Code {driver.driver_code}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className={expiryTone(driver.licenseDays)}>
                      License: {expiryLabel(driver.licenseDays)}
                    </Badge>
                    <Badge variant="outline" className={expiryTone(driver.pdpDays)}>
                      PDP: {expiryLabel(driver.pdpDays)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {formatDate(driver.license_expiry_date)} / {formatDate(driver.pdp_expiry_date)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Driver Status Board</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drivers have been imported yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Code</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Driver</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">State</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Days</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Warning</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase">Allocatable</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((driver) => {
                        const leave = leaveByDriverId.get(driver.id as string)
                        const driverEditor = editorByDriverId.get(driver.id as string)

                        return (
                          <tr key={driver.id as string} className="border-b border-border last:border-0 align-top">
                            <td className="py-3 pr-3 text-sm font-medium text-accent">{driver.driver_code}</td>
                            <td className="py-3 pr-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {driver.first_name} {driver.surname}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Vehicle: {driver.current_vehicle_id ? String(driver.current_vehicle_id).slice(0, 8) : "None"}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <Badge variant="outline" className={statusTone(String(driver.current_state))}>
                                {String(driver.current_state).replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3 text-sm text-foreground">{driver.current_state_days}</td>
                            <td className="py-3 pr-3">
                              <Badge variant="outline" className={warningTone(String(driver.warning_level))}>
                                {driver.warning_level}
                              </Badge>
                            </td>
                            <td className="py-3 pr-3 text-sm text-foreground">{driver.is_allocatable ? "Yes" : "No"}</td>
                            <td className="py-3 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <form action={submitMoveDriverOff}>
                                  <input type="hidden" name="driverId" value={String(driver.id)} />
                                  <input type="hidden" name="reasonCode" value="manual_off" />
                                  <Button type="submit" size="sm" variant="outline">Move Off</Button>
                                </form>
                                <form action={submitMoveDriverActive}>
                                  <input type="hidden" name="driverId" value={String(driver.id)} />
                                  <Button type="submit" size="sm">Move Active</Button>
                                </form>
                                {driverEditor ? (
                                  <DriverFormModal
                                    triggerLabel="Edit"
                                    triggerVariant="secondary"
                                    driver={{
                                      id: String(driverEditor.id),
                                      driver_code: driverEditor.driver_code as string | null,
                                      employee_number: driverEditor.employee_number as string | null,
                                      first_name: driverEditor.first_name as string | null,
                                      surname: driverEditor.surname as string | null,
                                      display_name: driverEditor.display_name as string | null,
                                      cell_number: driverEditor.cell_number as string | null,
                                      email_address: driverEditor.email_address as string | null,
                                      license_number: driverEditor.license_number as string | null,
                                      license_expiry_date: driverEditor.license_expiry_date as string | null,
                                      pdp_expiry_date: driverEditor.pdp_expiry_date as string | null,
                                      passport_expiry: driverEditor.passport_expiry as string | null,
                                      training_last_done: driverEditor.training_last_done as string | null,
                                      current_state: driverEditor.current_state as string | null,
                                      available: driverEditor.available as boolean | null,
                                      is_allocatable: driverEditor.is_allocatable as boolean | null,
                                    }}
                                  />
                                ) : null}
                              </div>
                              {leave ? (
                                <form action={submitEndDriverLeave}>
                                  <input type="hidden" name="leaveId" value={String(leave.id)} />
                                  <Button type="submit" size="sm" variant="outline">End Leave</Button>
                                </form>
                              ) : (
                                <form action={submitMarkDriverLeave} className="flex flex-wrap items-center gap-2">
                                  <input type="hidden" name="driverId" value={String(driver.id)} />
                                  <input type="date" name="leaveStart" className="h-9 rounded-md border border-input px-3 text-sm" required />
                                  <input type="date" name="leaveEnd" className="h-9 rounded-md border border-input px-3 text-sm" required />
                                  <input type="text" name="reason" placeholder="Reason" className="h-9 rounded-md border border-input px-3 text-sm" />
                                  <Button type="submit" size="sm" variant="secondary">Mark Leave</Button>
                                </form>
                              )}
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
              <CardTitle>Driver Spotlight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDriver ? (
                <p className="text-sm text-muted-foreground">No driver details are available yet.</p>
              ) : (
                <>
                  <div>
                    <p className="text-xl font-semibold text-foreground">
                      {selectedDriver.first_name} {selectedDriver.surname}
                    </p>
                    <p className="text-sm text-muted-foreground">Code {selectedDriver.driver_code}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Current State</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{String(selectedDriver.current_state).replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{selectedDriver.current_state_days} days in state</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Eligibility</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{selectedDriver.is_allocatable ? "Allocatable" : "Blocked"}</p>
                      <p className="text-xs text-muted-foreground">Warning level: {selectedDriver.warning_level}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Compliance</p>
                      <p className="mt-1 text-sm text-foreground">License expiry: {formatDate(selectedDriver.license_expiry_date as string | null)}</p>
                      <p className="text-sm text-foreground">PDP expiry: {formatDate(selectedDriver.pdp_expiry_date as string | null)}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Leave</p>
                      {selectedDriverLeave ? (
                        <>
                          <p className="mt-1 text-sm font-medium text-foreground">{selectedDriverLeave.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(selectedDriverLeave.leave_start as string)} to {formatDate(selectedDriverLeave.leave_end as string)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">No active or scheduled leave.</p>
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
