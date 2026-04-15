"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarDays } from "lucide-react"

type DriverOffCalendarPopoverProps = {
  driverName: string
  offDate: string
  daysUntilOff: number
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function DriverOffCalendarPopover({
  driverName,
  offDate,
  daysUntilOff,
}: DriverOffCalendarPopoverProps) {
  const today = startOfDay(new Date())
  const off = startOfDay(new Date(`${offDate}T00:00:00`))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs">
          <CalendarDays className="mr-1 h-3.5 w-3.5" />
          Calendar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">{driverName}</p>
          <p className="text-xs text-muted-foreground">
            {daysUntilOff <= 0 ? "Driver should already be off" : `${daysUntilOff} day${daysUntilOff === 1 ? "" : "s"} until off`}
          </p>
          <p className="text-xs text-muted-foreground">Off date: {offDate}</p>
        </div>
        <Calendar
          mode="range"
          selected={{ from: today, to: off }}
          defaultMonth={off}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  )
}
