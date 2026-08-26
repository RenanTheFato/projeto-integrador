/**
 * System users.
 *
 * The backend exposes only `POST /auth/register` — there is no endpoint that
 * lists users — so this screen is a creation form and says so, instead of
 * pretending to be a listing that never fills.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { ShieldPlus, UserPlus } from "lucide-react"

import { auth, firefighters } from "@/api/endpoints"
import { RANK_LABEL, USER_ROLE_LABEL, optionsOf } from "@/api/labels"
import type { User, UserRole } from "@/api/types"
import {
  ActionButton, Field, Page, PageHeader, Panel, Select, TextInput,
} from "@/components/layout/kit"
import { ErrorBox, ErrorDetails } from "@/components/layout/feedback"
import { useMutation, useResource } from "@/hooks/use-resource"

export default function Usuarios() {
  const roster = useResource(() => firefighters.list({ status: "ATIVO", per_page: 100 }), [])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<string>("OPERADOR")
  const [firefighterId, setFirefighterId] = useState("")
  const [created, setCreated] = useState<User | null>(null)

  const register = useMutation(auth.register)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setCreated(null)

    const user = await register.run({
      email: email.trim(),
      password,
      role: role as UserRole,
      firefighter_id: firefighterId || undefined,
    })

    if (user) {
      setCreated(user)
      setEmail("")
      setPassword("")
      setFirefighterId("")
    }
  }

  return (
    <Page>
      <PageHeader
        title="Usuários do sistema"
        subtitle="Contas de acesso ao painel — apenas administradores podem criar"
      />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Panel title="Nova conta" icon={<UserPlus className="h-5 w-5" />}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {register.error && <ErrorBox message={register.error} />}
            <ErrorDetails details={register.details} />

            {created && (
              <div className="border border-green-700 bg-green-700/10 px-4 py-3 text-neutral-900">
                Conta <strong>{created.email}</strong> criada como {USER_ROLE_LABEL[created.role]}.
              </div>
            )}

            <Field label="E-mail" required>
              <TextInput
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operador@bombeiros.local"
              />
            </Field>

            <Field label="Senha" required hint="Mínimo de 8 caracteres">
              <TextInput
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            <Field label="Perfil" required>
              <Select value={role} onChange={setRole} options={optionsOf(USER_ROLE_LABEL)} />
            </Field>

            <Field label="Bombeiro vinculado" hint="Opcional — liga a conta a alguém do efetivo">
              <Select
                value={firefighterId}
                onChange={setFirefighterId}
                placeholder="Nenhum"
                options={(roster.data?.items ?? []).map((firefighter) => ({
                  value: firefighter.id,
                  label: `${RANK_LABEL[firefighter.rank]} ${firefighter.war_name}`,
                }))}
              />
            </Field>

            <ActionButton tone="primary" type="submit" disabled={register.submitting}>
              <UserPlus className="h-5 w-5" />
              {register.submitting ? "Criando..." : "Criar conta"}
            </ActionButton>
          </form>
        </Panel>

        <Panel title="O que cada perfil pode fazer" icon={<ShieldPlus className="h-5 w-5" />}>
          <Permission
            role="Administrador"
            description="Acesso total. Só o administrador exclui registros, cadastra usuários e dispara o treinamento da rede neural."
          />
          <Permission
            role="Comandante"
            description="Gerencia efetivo, viaturas, guarnições, turnos e unidades, além de todo o fluxo operacional."
          />
          <Permission
            role="Operador"
            description="Registra ocorrências e despacha viaturas. Não altera cadastros."
          />

          <p className="border-t border-neutral-200 pt-3 text-sm text-neutral-600">
            A API não oferece listagem de usuários, então esta tela apenas cria contas. Para
            revogar um acesso é preciso mexer no banco.
          </p>
        </Panel>
      </div>
    </Page>
  )
}

function Permission({ role, description }: { role: string, description: string }) {
  return (
    <div className="border-l-4 border-[#DE5656] bg-[#F5EFE6] px-4 py-2">
      <p className="font-bold text-neutral-900">{role}</p>
      <p className="text-neutral-700">{description}</p>
    </div>
  )
}
