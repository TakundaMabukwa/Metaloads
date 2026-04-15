import dotenv from "dotenv"

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

const headers = {
  "Content-Type": "application/json",
}

if (cronSecret) {
  headers.Authorization = `Bearer ${cronSecret}`
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
