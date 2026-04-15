"use client"

import { useMemo, useState } from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DriverOffCalendarPopover } from "@/components/driver-off-calendar-popover"

type DriverRow = {
  id: string
  driver_code: string | null
  first_name: string | null
  surname: string | null
  current_state: string | null
  current_state_days: number | null
  current_vehicle?: {
    vehicle_number: string | null
    registration_number: string | null
  } | null
}

function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date)
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
  }).format(value)
}

function weekdayLetter(date: Date) {
  const day = date.getDay()
  if (day === 0 || day === 6) return "S"
  if (day === 2 || day === 4) return "T"
  return ["S", "M", "T", "W", "T", "F", "S"][day]
}

function offDateForDriver(daysOn: number) {
  return addDays(new Date(), Math.max(0, 33 - daysOn))
}

function onDateForDriver(daysOff: number) {
  return addDays(new Date(), Math.max(0, 7 - daysOff))
}

function activeThresholdRow(days: number) {
  if (days > 33) return "bg-red-50/90"
  if (days >= 30 && days < 33) return "bg-amber-50/90"
  return ""
}

export function DashboardSevenDayView({
  activeDriverBoard,
  offDriverBoard,
}: {
  activeDriverBoard: DriverRow[]
  offDriverBoard: DriverRow[]
}) {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const sevenDayColumns = Array.from({ length: 7 }, (_, index) => addDays(new Date(), index))
  const selectedDateKey = startOfDay(selectedDate).toISOString().slice(0, 10)

  const driversComingOff = useMemo(
    () =>
      activeDriverBoard.filter((driver) => {
        const offDateKey = offDateForDriver(Number(driver.current_state_days ?? 0)).toISOString().slice(0, 10)
        return offDateKey === selectedDateKey
      }),
    [activeDriverBoard, selectedDateKey]
  )

  const driversComingOn = useMemo(
    () =>
      offDriverBoard.filter((driver) => {
        const onDateKey = onDateForDriver(Number(driver.current_state_days ?? 0)).toISOString().slice(0, 10)
        return onDateKey === selectedDateKey
      }),
    [offDriverBoard, selectedDateKey]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>7 Day Driver View</CardTitle>
              <p className="text-sm text-muted-foreground">
                Live assigned drivers projected across the next seven days. Drivers switch to off once they hit the 33-day threshold.
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-fit">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {formatDate(selectedDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={(value) => value && setSelectedDate(startOfDay(value))} />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Drivers Coming Off</h3>
              <span className="text-xs text-muted-foreground">{driversComingOff.length} on {formatDate(selectedDate)}</span>
            </div>
            {driversComingOff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No drivers are scheduled to come off on this date.</p>
            ) : (
              <div className="space-y-3">
                {driversComingOff.map((driver) => (
                  <div key={driver.id} className="rounded-md border border-border p-3">
                    <div className="text-sm font-medium text-foreground">{driver.first_name} {driver.surname}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {driver.driver_code} · {driver.current_vehicle?.vehicle_number ?? "Assigned"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Drivers Coming On</h3>
              <span className="text-xs text-muted-foreground">{driversComingOn.length} on {formatDate(selectedDate)}</span>
            </div>
            {driversComingOn.length === 0 ? (
              <p className="text-sm text-muted-foreground">No off drivers become eligible to come on on this date.</p>
            ) : (
              <div className="space-y-3">
                {driversComingOn.map((driver) => (
                  <div key={driver.id} className="rounded-md border border-border p-3">
                    <div className="text-sm font-medium text-foreground">{driver.first_name} {driver.surname}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {driver.driver_code} · {Number(driver.current_state_days ?? 0)} day{Number(driver.current_state_days ?? 0) === 1 ? "" : "s"} off
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {activeDriverBoard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active assigned drivers are available yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-secondary/40">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Driver</th>
                    {sevenDayColumns.map((date) => (
                      <th key={date.toISOString()} className="px-3 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                        <div>{weekdayLetter(date)}</div>
                        <div className="mt-1 text-[11px] normal-case text-muted-foreground">{formatShortDate(date)}</div>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Off Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Calendar</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDriverBoard.map((driver) => {
                    const daysOn = Number(driver.current_state_days ?? 0)
                    const offDate = offDateForDriver(daysOn)
                    const offDateKey = offDate.toISOString().slice(0, 10)
                    const vehicleLabel = driver.current_vehicle?.vehicle_number ?? "Assigned"
                    const vehicleReg = driver.current_vehicle?.registration_number ?? ""
                    const daysUntilOff = Math.max(0, 33 - daysOn)

                    return (
                      <tr
                        key={driver.id}
                        className={`border-b border-border last:border-0 ${activeThresholdRow(daysOn)}`}
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="text-sm font-medium text-foreground">{driver.first_name} {driver.surname}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {driver.driver_code} · {vehicleLabel}{vehicleReg ? ` - ${vehicleReg}` : ""}
                          </div>
                        </td>
                        {sevenDayColumns.map((date) => {
                          const dateKey = date.toISOString().slice(0, 10)
                          const isOnAssignment = dateKey <= offDateKey
                          return (
                            <td key={`${driver.id}-${dateKey}`} className="px-2 py-3 text-center">
                              <div
                                className={`rounded-md px-2 py-2 text-xs font-medium ${
                                  isOnAssignment ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {isOnAssignment ? vehicleLabel : "Off"}
                              </div>
                            </td>
                          )
                        })}
                        <td className="px-3 py-3 align-top">
                          <div className="text-sm text-foreground">{formatDate(offDateKey)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {daysUntilOff <= 0 ? "Off now" : `${daysUntilOff} day${daysUntilOff === 1 ? "" : "s"} left`}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <DriverOffCalendarPopover
                            driverName={`${driver.first_name} ${driver.surname}`}
                            offDate={offDateKey}
                            daysUntilOff={daysUntilOff}
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
    </div>
  )
}
