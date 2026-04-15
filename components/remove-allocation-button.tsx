"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RemoveAllocationButton({
  allocationId,
  endedReason = "manual_remove",
}: {
  allocationId: string
  endedReason?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 w-full sm:w-auto"
        disabled={isPending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const response = await fetch("/api/allocations/remove", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ allocationId, endedReason }),
            })

            const payload = await response.json().catch(() => null)

            if (!response.ok) {
              setError(payload?.error ?? "Failed to remove allocation")
              return
            }

            router.refresh()
          })
        }}
      >
        <UserMinus className="mr-2 h-4 w-4" />
        {isPending ? "Removing..." : "Remove"}
      </Button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
