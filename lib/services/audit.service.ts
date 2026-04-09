import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function writeAuditLog(input: {
  entityType: "driver" | "vehicle" | "allocation" | "leave" | "roster_import" | "user" | "cron_job"
  entityId?: string | null
  action: string
  actorUserId?: string | null
  beforeData?: unknown
  afterData?: unknown
  metadata?: Record<string, unknown>
}) {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from("audit_logs").insert({
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    actor_user_id: input.actorUserId ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) throw error
}

