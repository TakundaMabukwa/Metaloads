import { LoginForm } from "@/components/login-form"

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center bg-sidebar p-6 md:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#54a4df_0%,transparent_34%),linear-gradient(135deg,#0c111a_0%,#132338_46%,#1b75bb_100%)]" />
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
