import { LoginForm } from "@/components/login-form"

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center bg-sidebar p-6 md:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#158b8d_0%,transparent_45%),linear-gradient(135deg,#06232a_0%,#0a2f38_50%,#051c22_100%)]" />
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
