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
import { createVehicleAction, updateVehicleAction } from "@/lib/actions/vehicles"

type VehicleFormModalProps = {
  triggerLabel: string
  triggerVariant?: "default" | "secondary" | "outline"
  vehicle?: {
    id: string
    vehicle_number: string | null
    registration_number: string | null
    display_label: string | null
    make: string | null
    model: string | null
    vehicle_type: string | null
    vin_number: string | null
    trailer_1_registration: string | null
    trailer_2_registration: string | null
    branch_name: string | null
    dekra_service_status: string | null
    license_expiry_date: string | null
    vehicle_priority: number | null
    status: string | null
    needs_allocation: boolean | null
    allocation_locked: boolean | null
  }
}

export function VehicleFormModal({ triggerLabel, triggerVariant = "default", vehicle }: VehicleFormModalProps) {
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
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          <DialogDescription>
            {vehicle ? "Update the fleet vehicle record and readiness flags." : "Add a new vehicle to the fleet register."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            const formData = new FormData(event.currentTarget)

            const payload = {
              vehicleId: vehicle?.id,
              vehicleNumber: String(formData.get("vehicleNumber") ?? ""),
              registrationNumber: String(formData.get("registrationNumber") ?? ""),
              displayLabel: String(formData.get("displayLabel") ?? ""),
              make: String(formData.get("make") ?? ""),
              model: String(formData.get("model") ?? ""),
              vehicleType: String(formData.get("vehicleType") ?? ""),
              vinNumber: String(formData.get("vinNumber") ?? ""),
              trailer1Registration: String(formData.get("trailer1Registration") ?? ""),
              trailer2Registration: String(formData.get("trailer2Registration") ?? ""),
              branchName: String(formData.get("branchName") ?? ""),
              dekraServiceStatus: String(formData.get("dekraServiceStatus") ?? ""),
              licenseExpiryDate: String(formData.get("licenseExpiryDate") ?? ""),
              vehiclePriority: Number(formData.get("vehiclePriority") ?? 0),
              status: String(formData.get("status") ?? "active"),
              needsAllocation: formData.get("needsAllocation") === "on",
              allocationLocked: formData.get("allocationLocked") === "on",
            }

            startTransition(async () => {
              try {
                if (vehicle) {
                  await updateVehicleAction(payload)
                } else {
                  await createVehicleAction(payload)
                }
                setOpen(false)
                window.location.reload()
              } catch (actionError) {
                setError(actionError instanceof Error ? actionError.message : "Unable to save vehicle")
              }
            })
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicleNumber">Vehicle Number</Label>
              <Input id="vehicleNumber" name="vehicleNumber" defaultValue={vehicle?.vehicle_number ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number</Label>
              <Input id="registrationNumber" name="registrationNumber" defaultValue={vehicle?.registration_number ?? ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="displayLabel">Display Label</Label>
              <Input id="displayLabel" name="displayLabel" defaultValue={vehicle?.display_label ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="make">Make</Label>
              <Input id="make" name="make" defaultValue={vehicle?.make ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" defaultValue={vehicle?.model ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleType">Vehicle Type</Label>
              <Input id="vehicleType" name="vehicleType" defaultValue={vehicle?.vehicle_type ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vinNumber">VIN Number</Label>
              <Input id="vinNumber" name="vinNumber" defaultValue={vehicle?.vin_number ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trailer1Registration">Trailer 1 Registration</Label>
              <Input id="trailer1Registration" name="trailer1Registration" defaultValue={vehicle?.trailer_1_registration ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trailer2Registration">Trailer 2 Registration</Label>
              <Input id="trailer2Registration" name="trailer2Registration" defaultValue={vehicle?.trailer_2_registration ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch</Label>
              <Input id="branchName" name="branchName" defaultValue={vehicle?.branch_name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dekraServiceStatus">Dekra Service Status</Label>
              <Input id="dekraServiceStatus" name="dekraServiceStatus" defaultValue={vehicle?.dekra_service_status ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseExpiryDate">License Expiry Date</Label>
              <Input id="licenseExpiryDate" name="licenseExpiryDate" type="date" defaultValue={vehicle?.license_expiry_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehiclePriority">Vehicle Priority</Label>
              <Input id="vehiclePriority" name="vehiclePriority" type="number" min="0" defaultValue={vehicle?.vehicle_priority ?? 0} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" defaultValue={vehicle?.status ?? "active"} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox name="needsAllocation" defaultChecked={vehicle?.needs_allocation ?? true} />
              Needs allocation
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox name="allocationLocked" defaultChecked={vehicle?.allocation_locked ?? false} />
              Allocation locked
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : vehicle ? "Save Vehicle" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
