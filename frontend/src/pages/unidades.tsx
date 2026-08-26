/**
 * The hierarchy of units.
 *
 * It mirrors the real structure of the corporation — Comando Geral, Comando
 * Regional, Grupamento, Subgrupamento, Posto — and the backend only accepts a
 * unit subordinated to a strictly higher level, so the parent list offered
 * here is filtered to those levels instead of listing everything.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Building2, Plus } from "lucide-react"

import { units } from "@/api/endpoints"
import { UNIT_TYPE_LABEL, optionsOf } from "@/api/labels"
import type { Unit, UnitType } from "@/api/types"
import {
  ActionButton, Badge, Cell, ConfirmButton, Field, Modal, Page, PageHeader, Pagination,
  Panel, Row, Select, Table, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, ErrorDetails, LoadingBlock } from "@/components/layout/feedback"
import { useAuth } from "@/auth/auth-context"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatCoordinate } from "@/lib/format"

/** Ordered from the top down; a unit may only hang off a level above its own. */
const HIERARCHY: UnitType[] = [
  "COMANDO_GERAL", "COMANDO_REGIONAL", "GRUPAMENTO", "SUBGRUPAMENTO", "POSTO",
]

export default function Unidades() {
  const { can } = useAuth()
  const mayDelete = can(["ADMIN"])

  const [page, setPage] = useState(1)
  const [type, setType] = useState("")
  const [creating, setCreating] = useState(false)

  const list = useResource(
    () => units.list({ page, per_page: 15, type: (type || undefined) as UnitType | undefined }),
    [page, type],
  )

  const all = useResource(() => units.list({ per_page: 100 }), [])

  return (
    <Page>
      <PageHeader
        title="Unidades"
        subtitle="Estrutura do Corpo de Bombeiros, do Comando Geral ao Posto"
        actions={
          <ActionButton tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" />
            Nova unidade
          </ActionButton>
        }
      />

      <Panel title="Filtros">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nível">
            <Select
              value={type}
              onChange={(value) => { setType(value); setPage(1) }}
              placeholder="Todos"
              options={optionsOf(UNIT_TYPE_LABEL)}
            />
          </Field>
        </div>
      </Panel>

      {list.loading && !list.data && <LoadingBlock />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.items.length === 0 && <EmptyState title="Nenhuma unidade encontrada" />}

      {list.data && list.data.items.length > 0 && (
        <Panel title="Unidades" icon={<Building2 className="h-5 w-5" />}>
          <Table headers={[
            "Sigla", "Nome", "Nível", "Subordinada a", "Cidade", "Coordenadas", "Situação",
            ...(mayDelete ? ["Ações"] : []),
          ]}>
            {list.data.items.map((unit) => (
              <UnitRow key={unit.id} unit={unit} mayDelete={mayDelete} onChanged={list.reload} />
            ))}
          </Table>

          <Pagination page={list.data.page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />
        </Panel>
      )}

      {creating && (
        <CreateUnitModal
          existing={all.data?.items ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); list.reload(); all.reload() }}
        />
      )}
    </Page>
  )
}

function UnitRow({ unit, mayDelete, onChanged }: {
  unit: Unit
  mayDelete: boolean
  onChanged: () => void
}) {
  const remove = useMutation(() => units.remove(unit.id))
  const deactivate = useMutation(() => units.update(unit.id, { active: false }))

  return (
    <Row>
      <Cell className="font-bold">{unit.acronym}</Cell>
      <Cell>{unit.name}</Cell>
      <Cell>{UNIT_TYPE_LABEL[unit.type]}</Cell>
      <Cell>{unit.parent?.acronym ?? "—"}</Cell>
      <Cell>{unit.city}/{unit.state}</Cell>
      <Cell className="whitespace-nowrap font-mono text-sm">
        {formatCoordinate(unit.latitude)}, {formatCoordinate(unit.longitude)}
      </Cell>
      <Cell>
        <Badge tone={unit.active ? "bg-green-600" : "bg-neutral-500"}>
          {unit.active ? "Ativa" : "Inativa"}
        </Badge>
      </Cell>

      {mayDelete && (
        <Cell>
          <div className="flex flex-wrap gap-1.5">
            {unit.active && (
              <ActionButton
                tone="neutral"
                className="px-2.5 py-1 text-sm"
                disabled={deactivate.submitting}
                onClick={async () => {
                  const done = await deactivate.run(undefined)
                  if (done) onChanged()
                }}
              >
                Desativar
              </ActionButton>
            )}

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
          </div>

          {(remove.error || deactivate.error) && (
            <span className="mt-1 block max-w-xs text-sm text-[#DE5656]">
              {remove.error ?? deactivate.error}
            </span>
          )}
        </Cell>
      )}
    </Row>
  )
}

function CreateUnitModal({ existing, onClose, onCreated }: {
  existing: Unit[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: "", acronym: "", type: "POSTO" as UnitType, address: "",
    city: "Taubaté", state: "SP", phone: "",
    latitude: "-23.0264", longitude: "-45.5551", parent_id: "",
  })

  const create = useMutation(units.create)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  // Only units strictly above the chosen level can be the parent.
  const levelIndex = HIERARCHY.indexOf(form.type)
  const parentOptions = existing
    .filter((unit) => HIERARCHY.indexOf(unit.type) < levelIndex)
    .map((unit) => ({ value: unit.id, label: `${unit.acronym} — ${UNIT_TYPE_LABEL[unit.type]}` }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const created = await create.run({
      name: form.name.trim(),
      acronym: form.acronym.trim().toUpperCase(),
      type: form.type,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      phone: form.phone.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      parent_id: form.parent_id || undefined,
    })

    if (created) onCreated()
  }

  return (
    <Modal title="Cadastrar unidade" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {create.error && <ErrorBox message={create.error} />}
        <ErrorDetails details={create.details} />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" required>
            <TextInput required value={form.name} onChange={(event) => set("name")(event.target.value)} placeholder="Posto de Bombeiros de Taubaté" />
          </Field>

          <Field label="Sigla" required>
            <TextInput required value={form.acronym} onChange={(event) => set("acronym")(event.target.value)} placeholder="PB-TAUBATE" />
          </Field>

          <Field label="Nível" required>
            <Select
              value={form.type}
              onChange={(value) => { set("type")(value); set("parent_id")("") }}
              options={optionsOf(UNIT_TYPE_LABEL)}
            />
          </Field>

          <Field
            label="Subordinada a"
            hint={levelIndex === 0 ? "O Comando Geral não é subordinado a ninguém" : "Somente níveis acima do escolhido"}
          >
            <Select
              value={form.parent_id}
              onChange={set("parent_id")}
              disabled={levelIndex === 0}
              placeholder="Nenhuma"
              options={parentOptions}
            />
          </Field>

          <Field label="Endereço" required>
            <TextInput required value={form.address} onChange={(event) => set("address")(event.target.value)} />
          </Field>

          <Field label="Telefone" required>
            <TextInput required value={form.phone} onChange={(event) => set("phone")(event.target.value)} placeholder="1236250100" />
          </Field>

          <Field label="Cidade" required>
            <TextInput required value={form.city} onChange={(event) => set("city")(event.target.value)} />
          </Field>

          <Field label="Estado" required>
            <TextInput required maxLength={2} value={form.state} onChange={(event) => set("state")(event.target.value)} />
          </Field>

          <Field label="Latitude" required>
            <TextInput required value={form.latitude} onChange={(event) => set("latitude")(event.target.value)} />
          </Field>

          <Field label="Longitude" required>
            <TextInput required value={form.longitude} onChange={(event) => set("longitude")(event.target.value)} />
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
