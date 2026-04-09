"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { submitAutoAllocate } from "@/lib/actions/page-forms"
import type { AutoAllocateActionResult } from "@/lib/actions/page-forms"
import { toast } from "@/hooks/use-toast"

type AutoAllocateResult = AutoAllocateActionResult | undefined

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      className="bg-accent hover:bg-accent/90 text-accent-foreground"
      disabled={pending}
    >
      <Truck className={`mr-2 h-4 w-4 ${pending ? "animate-pulse" : ""}`} />
      {pending ? "Auto-Allocating..." : "Auto Allocate"}
    </Button>
  )
}

const initialState: AutoAllocateResult = undefined

export function AutoAllocateButton() {
  const [state, formAction] = useActionState(submitAutoAllocate, initialState)

  useEffect(() => {
    if (!state) return

    if (state.status === "success") {
      toast({
        title: "Auto-allocation completed",
        description: `Allocated ${state.allocated ?? 0} vehicles, rotation assignments ${state.rotationAssigned ?? 0}, skipped ${state.skipped ?? 0}.`,
      })
      return
    }

    toast({
      title: "Auto-allocation skipped",
      description: state.message ?? "No allocation run was started.",
    })
  }, [state])

  return (
    <form action={formAction}>
      <SubmitButton />
    </form>
  )
}
