import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function startCronJob(jobName: string, triggeredBy = "system") {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc("start_cron_job_run", {
    p_job_name: jobName,
    p_triggered_by: triggeredBy,
  })

  if (error) throw error

  return {
    started: Boolean(data),
    id: (data as string | null) ?? null,
  }
}

export async function finishCronJob(
  runId: string,
  status: "success" | "failed" | "skipped",
  summary: Record<string, unknown>,
  errorMessage?: string
) {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc("finish_cron_job_run", {
    p_run_id: runId,
    p_status: status,
    p_summary: summary,
    p_error_message: errorMessage ?? null,
  })

  if (error) throw error
}
