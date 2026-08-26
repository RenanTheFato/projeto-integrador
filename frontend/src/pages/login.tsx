import { useState } from "react"
import type { FormEvent } from "react"
import { Loader2, LogIn } from "lucide-react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"

import zeno from "@/assets/Zeno.png"
import { ActionButton, Field, TextInput } from "@/components/layout/kit"
import { ErrorBox, FullPageSpinner } from "@/components/layout/feedback"
import { useAuth } from "@/auth/auth-context"
import { messageOf } from "@/hooks/use-resource"

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullPageSpinner label="Verificando sessão..." />

  // Someone who is already signed in has no business on this screen.
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== "/login" ? from : "/", { replace: true })
    } catch (cause: unknown) {
      setError(messageOf(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5EFE6] px-4">
      <div className="w-full max-w-md border bg-white shadow-xl">
        <div className="flex flex-col items-center gap-1 bg-linear-to-r from-red-300 to-orange-300 px-6 py-5">
          <img src={zeno} alt="Zeno" className="h-24 w-24 object-contain" />
          <h1 className="text-2xl font-bold text-neutral-900">Central de Despacho</h1>
          <p className="text-neutral-800">Corpo de Bombeiros — Taubaté</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          {error && <ErrorBox message={error} />}

          <Field label="E-mail" required>
            <TextInput
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@bombeiros.local"
            />
          </Field>

          <Field label="Senha" required>
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <ActionButton tone="primary" type="submit" disabled={submitting} className="mt-2 py-3 text-lg">
            {submitting
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Entrando...</>
              : <><LogIn className="h-5 w-5" /> Entrar</>}
          </ActionButton>
        </form>
      </div>
    </div>
  )
}
