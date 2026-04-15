"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createDriverAction, updateDriverAction } from "@/lib/actions/drivers"

type DriverFormModalProps = {
  triggerLabel: string
  triggerVariant?: "default" | "secondary" | "outline"
  driver?: {
    id: string
    driver_code: string | null
    employee_number: string | null
    first_name: string | null
    surname: string | null
    display_name: string | null
    cell_number: string | null
    email_address: string | null
    license_number: string | null
    license_expiry_date: string | null
    pdp_expiry_date: string | null
    passport_expiry: string | null
    training_last_done: string | null
    current_state: string | null
    available: boolean | null
    is_allocatable: boolean | null
  }
}

const states = ["active", "off", "inactive", "on_leave", "suspended"] as const

export function DriverFormModal({ triggerLabel, triggerVariant = "default", driver }: DriverFormModalProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{driver ? "Edit Driver" : "Add Driver"}</DialogTitle>
          <DialogDescription>
            {driver ? "Update the driver profile and operational state." : "Create a new driver profile for fleet operations."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            const formData = new FormData(event.currentTarget)

            const payload = {
              driverId: driver?.id,
              driverCode: String(formData.get("driverCode") ?? ""),
              employeeNumber: String(formData.get("employeeNumber") ?? ""),
              firstName: String(formData.get("firstName") ?? ""),
              surname: String(formData.get("surname") ?? ""),
              displayName: String(formData.get("displayName") ?? ""),
              cellNumber: String(formData.get("cellNumber") ?? ""),
              emailAddress: String(formData.get("emailAddress") ?? ""),
              licenseNumber: String(formData.get("licenseNumber") ?? ""),
              licenseExpiryDate: String(formData.get("licenseExpiryDate") ?? ""),
              pdpExpiryDate: String(formData.get("pdpExpiryDate") ?? ""),
              passportExpiry: String(formData.get("passportExpiry") ?? ""),
              trainingLastDone: String(formData.get("trainingLastDone") ?? ""),
              state: String(formData.get("state") ?? "off"),
              available: formData.get("available") === "on",
              isAllocatable: formData.get("isAllocatable") === "on",
            }

            startTransition(async () => {
              try {
                if (driver) {
                  await updateDriverAction(payload)
                } else {
                  await createDriverAction(payload)
                }
                setOpen(false)
                window.location.reload()
              } catch (actionError) {
                setError(actionError instanceof Error ? actionError.message : "Unable to save driver")
              }
            })
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="driverCode">Driver Code</Label>
              <Input id="driverCode" name="driverCode" defaultValue={driver?.driver_code ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeNumber">Employee Number</Label>
              <Input id="employeeNumber" name="employeeNumber" defaultValue={driver?.employee_number ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" defaultValue={driver?.first_name ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname</Label>
              <Input id="surname" name="surname" defaultValue={driver?.surname ?? ""} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" name="displayName" defaultValue={driver?.display_name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cellNumber">Cell Number</Label>
              <Input id="cellNumber" name="cellNumber" defaultValue={driver?.cell_number ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailAddress">Email Address</Label>
              <Input id="emailAddress" name="emailAddress" type="email" defaultValue={driver?.email_address ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input id="licenseNumber" name="licenseNumber" defaultValue={driver?.license_number ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainingLastDone">Training Last Done</Label>
              <Input id="trainingLastDone" name="trainingLastDone" defaultValue={driver?.training_last_done ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseExpiryDate">License Expiry Date</Label>
              <Input id="licenseExpiryDate" name="licenseExpiryDate" type="date" defaultValue={driver?.license_expiry_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdpExpiryDate">PDP Expiry Date</Label>
              <Input id="pdpExpiryDate" name="pdpExpiryDate" type="date" defaultValue={driver?.pdp_expiry_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passportExpiry">Passport Expiry</Label>
              <Input id="passportExpiry" name="passportExpiry" type="date" defaultValue={driver?.passport_expiry ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Current State</Label>
              <select
                id="state"
                name="state"
                defaultValue={driver?.current_state ?? "off"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox name="available" defaultChecked={driver?.available ?? true} />
              Available
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox name="isAllocatable" defaultChecked={driver?.is_allocatable ?? true} />
              Allocatable
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : driver ? "Save Driver" : "Add Driver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
