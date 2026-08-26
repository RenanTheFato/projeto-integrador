/**
 * The roster.
 *
 * The CPF is validated by its check digits on the backend and cannot be
 * changed afterwards, so the form says so where it is typed rather than
 * letting the dispatcher discover it from a 400.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Plus, Users } from "lucide-react"

import { firefighters, units } from "@/api/endpoints"
import {
  FIREFIGHTER_STATUS_LABEL, FIREFIGHTER_STATUS_TONE, RANK_LABEL, optionsOf,
} from "@/api/labels"
import type { Firefighter, FirefighterStatus, Rank } from "@/api/types"
import {
  ActionButton, Badge, Cell, ConfirmButton, Field, Modal, Page, PageHeader, Pagination,
  Panel, Row, Select, Table, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, ErrorDetails, LoadingBlock } from "@/components/layout/feedback"
import { useAuth } from "@/auth/auth-context"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatDate } from "@/lib/format"

export default function Efetivo() {
  const { can } = useAuth()
  const mayManage = can(["ADMIN", "COMANDANTE"])
  const mayDelete = can(["ADMIN"])

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [unitId, setUnitId] = useState("")
  const [creating, setCreating] = useState(false)

  const unitList = useResource(() => units.list({ active: true }), [])

  const list = useResource(
    () => firefighters.list({
      page,
      per_page: 15,
      status: (status || undefined) as FirefighterStatus | undefined,
      unit_id: unitId || undefined,
    }),
    [page, status, unitId],
  )

  return (
    <Page>
      <PageHeader
        title="Efetivo"
        subtitle="Bombeiros cadastrados por unidade"
        actions={mayManage && (
          <ActionButton tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" />
            Novo bombeiro
          </ActionButton>
        )}
      />

      <Panel title="Filtros">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Situação">
            <Select
              value={status}
              onChange={(value) => { setStatus(value); setPage(1) }}
              placeholder="Todas"
              options={optionsOf(FIREFIGHTER_STATUS_LABEL)}
            />
          </Field>

          <Field label="Unidade">
            <Select
              value={unitId}
              onChange={(value) => { setUnitId(value); setPage(1) }}
              placeholder="Todas"
              options={(unitList.data?.items ?? []).map((unit) => ({ value: unit.id, label: unit.acronym }))}
            />
          </Field>
        </div>
      </Panel>

      {list.loading && !list.data && <LoadingBlock />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.items.length === 0 && <EmptyState title="Nenhum bombeiro encontrado" />}

      {list.data && list.data.items.length > 0 && (
        <Panel title="Bombeiros" icon={<Users className="h-5 w-5" />}>
          <Table headers={[
            "Nome de guerra", "Nome completo", "Posto/graduação", "Matrícula",
            "Unidade", "Admissão", "Situação", ...(mayDelete ? ["Ações"] : []),
          ]}>
            {list.data.items.map((firefighter) => (
              <FirefighterRow
                key={firefighter.id}
                firefighter={firefighter}
                mayDelete={mayDelete}
                onChanged={list.reload}
              />
            ))}
          </Table>

          <Pagination page={list.data.page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />
        </Panel>
      )}

      {creating && (
        <CreateFirefighterModal
          unitOptions={(unitList.data?.items ?? []).map((unit) => ({ value: unit.id, label: `${unit.acronym} — ${unit.name}` }))}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); list.reload() }}
        />
      )}
    </Page>
  )
}

function FirefighterRow({ firefighter, mayDelete, onChanged }: {
  firefighter: Firefighter
  mayDelete: boolean
  onChanged: () => void
}) {
  const remove = useMutation(() => firefighters.remove(firefighter.id))

  return (
    <Row>
      <Cell className="font-bold">{firefighter.war_name}</Cell>
      <Cell>{firefighter.name}</Cell>
      <Cell>{RANK_LABEL[firefighter.rank]}</Cell>
      <Cell className="font-mono text-sm">{firefighter.military_id}</Cell>
      <Cell>{firefighter.unit?.acronym ?? "—"}</Cell>
      <Cell className="whitespace-nowrap">{formatDate(firefighter.admission_date)}</Cell>
      <Cell>
        <Badge tone={FIREFIGHTER_STATUS_TONE[firefighter.status]}>
          {FIREFIGHTER_STATUS_LABEL[firefighter.status]}
        </Badge>
      </Cell>

      {mayDelete && (
        <Cell>
          <ConfirmButton
            label="Excluir"
            confirmLabel="Confirmar"
            className="px-2.5 py-1 text-sm"
            disabled={remove.submitting}
            onConfirm={async () => {
              const done = await remove.run(undefined)
              if (done) onChanged()
            }}
          />
          {remove.error && <span className="mt-1 block max-w-xs text-sm text-[#DE5656]">{remove.error}</span>}
        </Cell>
      )}
    </Row>
  )
}

function CreateFirefighterModal({ unitOptions, onClose, onCreated }: {
  unitOptions: { value: string, label: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: "", war_name: "", military_id: "", cpf: "",
    rank: "SOLDADO_PRIMEIRA_CLASSE" as Rank, phone: "", email: "",
    admission_date: "", unit_id: "",
  })

  const create = useMutation(firefighters.create)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const created = await create.run({
      ...form,
      email: form.email.trim() || undefined,
    })

    if (created) onCreated()
  }

  return (
    <Modal title="Cadastrar bombeiro" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {create.error && <ErrorBox message={create.error} />}
        <ErrorDetails details={create.details} />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome completo" required>
            <TextInput required value={form.name} onChange={(event) => set("name")(event.target.value)} />
          </Field>

          <Field label="Nome de guerra" required>
            <TextInput required value={form.war_name} onChange={(event) => set("war_name")(event.target.value)} />
          </Field>

          <Field label="Matrícula" required>
            <TextInput required value={form.military_id} onChange={(event) => set("military_id")(event.target.value)} />
          </Field>

          <Field label="CPF" required hint="Validado pelos dígitos verificadores e definitivo após o cadastro">
            <TextInput
              required
              value={form.cpf}
              onChange={(event) => set("cpf")(event.target.value)}
              placeholder="12345678909"
            />
          </Field>

          <Field label="Posto / graduação" required>
            <Select value={form.rank} onChange={set("rank")} options={optionsOf(RANK_LABEL)} />
          </Field>

          <Field label="Unidade" required>
            <Select value={form.unit_id} onChange={set("unit_id")} placeholder="Selecione" options={unitOptions} />
          </Field>

          <Field label="Telefone" required hint="Entre 10 e 15 caracteres">
            <TextInput
              required
              value={form.phone}
              onChange={(event) => set("phone")(event.target.value)}
              placeholder="12991234567"
            />
          </Field>

          <Field label="E-mail">
            <TextInput type="email" value={form.email} onChange={(event) => set("email")(event.target.value)} />
          </Field>

          <Field label="Data de admissão" required hint="Não pode ser uma data futura">
            <TextInput
              type="date"
              required
              value={form.admission_date}
              onChange={(event) => set("admission_date")(event.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton tone="ghost" type="button" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton tone="primary" type="submit" disabled={create.submitting}>
            {create.submitting ? "Salvando..." : "Cadastrar"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
