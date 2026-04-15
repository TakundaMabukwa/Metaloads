function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (() => {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL")
  })()

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  (() => {
    throw new Error(
      "Missing required environment variable. Expected one of: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  })()

export const env = {
  supabaseUrl,
  supabaseAnonKey: supabasePublishableKey,
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE_KEY,
  pingramApiKey: process.env.PINGRAM_API_KEY,
  pingramBaseUrl: process.env.PINGRAM_BASE_URL,
  cronSecret: process.env.CRON_SECRET,
  rosterBucket: process.env.SUPABASE_STORAGE_BUCKET_ROSTER ?? "roster-imports",
}

export function requireServiceRoleKey(): string {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE_KEY

  if (!value) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return value
}

export function requireCronSecret(): string {
  return requireEnv("CRON_SECRET")
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null
}

export function requirePingramApiKey(): string {
  return requireEnv("PINGRAM_API_KEY")
}
