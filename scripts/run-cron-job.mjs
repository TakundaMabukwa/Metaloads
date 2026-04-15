import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config({ path: ".env.local", override: true })
dotenv.config({ path: ".env", override: false })

const job = process.argv[2]

if (!job || !["monitor", "auto-allocate"].includes(job)) {
  console.error('Usage: node scripts/run-cron-job.mjs <monitor|auto-allocate>')
  process.exit(1)
}

const route = job === "monitor" ? "/api/cron/monitor" : "/api/cron/auto-allocate"
const baseUrl = process.env.CRON_BASE_URL || "http://127.0.0.1:3000"
const cronSecret = process.env.CRON_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const cronUserEmail = process.env.CRON_USER_EMAIL
const cronUserPassword = process.env.CRON_USER_PASSWORD

const headers = {
  "Content-Type": "application/json",
}

if (cronSecret) {
  headers.Authorization = `Bearer ${cronSecret}`
} else if (supabaseUrl && supabasePublishableKey && cronUserEmail && cronUserPassword) {
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { session },
    error: signInError,
  } = await supabase.auth.signInWithPassword({
    email: cronUserEmail,
    password: cronUserPassword,
  })

  if (signInError || !session?.access_token) {
    console.error(
      JSON.stringify(
        {
          job,
          route,
          status: 401,
          ok: false,
          error: signInError?.message ?? "Failed to sign in cron user",
        },
        null,
        2
      )
    )
    process.exit(1)
  }

  headers.Authorization = `Bearer ${session.access_token}`
}

const response = await fetch(`${baseUrl}${route}`, {
  method: "POST",
  headers,
})

const bodyText = await response.text()

console.log(
  JSON.stringify(
    {
      job,
      route,
      status: response.status,
      ok: response.ok,
      body: bodyText,
    },
    null,
    2
  )
)

if (!response.ok) {
  process.exit(1)
}
