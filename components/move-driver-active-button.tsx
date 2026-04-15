"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function MoveDriverActiveButton({ driverId }: { driverId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const response = await fetch("/api/drivers/move-active", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ driverId }),
            })

            const payload = await response.json().catch(() => null)

            if (!response.ok) {
              setError(payload?.error ?? "Failed to move driver active")
              return
            }

            router.refresh()
          })
        }}
      >
        {isPending ? "Moving..." : "Move Active"}
      </Button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
