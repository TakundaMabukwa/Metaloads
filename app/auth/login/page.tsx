import { LoginForm } from "@/components/login-form"

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center bg-sidebar p-6 md:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#86efac_0%,transparent_38%),linear-gradient(135deg,#14532d_0%,#166534_48%,#365314_100%)]" />
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
