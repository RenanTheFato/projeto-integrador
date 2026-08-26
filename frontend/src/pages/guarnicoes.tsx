/**
 * Crews: who rides which vehicle.
 *
 * A crew is what the dispatch screen offers alongside a truck, and the backend
 * only accepts a crew that belongs to the chosen vehicle — so the form binds
 * the two together at creation instead of leaving them to drift apart.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Plus, ShieldCheck, Users } from "lucide-react"

import { crews, firefighters, units, vehicles } from "@/api/endpoints"
import { CREW_ROLE_LABEL, RANK_LABEL, optionsOf } from "@/api/labels"
import type { Crew, CrewRole } from "@/api/types"
import {
  ActionButton, Badge, Cell, ConfirmButton, Field, Modal, Page, PageHeader, Pagination,
  Panel, Row, Select, Table, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, ErrorDetails, LoadingBlock } from "@/components/layout/feedback"
import { useAuth } from "@/auth/auth-context"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatDateTime, toLocalInputValue } from "@/lib/format"

export default function Guarnicoes() {
  const { can } = useAuth()
  const mayManage = can(["ADMIN", "COMANDANTE"])
  const mayDelete = can(["ADMIN"])

  const [page, setPage] = useState(1)
  const [onlyActive, setOnlyActive] = useState("true")
  const [creating, setCreating] = useState(false)

  const list = useResource(
    () => crews.list({ page, per_page: 15, active: onlyActive === "true" ? true : undefined }),
    [page, onlyActive],
  )

  return (
    <Page>
      <PageHeader
        title="Guarnições"
        subtitle="Composição das equipes por viatura"
        actions={mayManage && (
          <ActionButton tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" />
            Nova guarnição
          </ActionButton>
        )}
      />

      <Panel title="Filtros">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Exibir">
            <Select
              value={onlyActive}
              onChange={(value) => { setOnlyActive(value); setPage(1) }}
              options={[
                { value: "true", label: "Somente em serviço" },
                { value: "false", label: "Todas" },
              ]}
            />
          </Field>
        </div>
      </Panel>

      {list.loading && !list.data && <LoadingBlock />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.items.length === 0 && <EmptyState title="Nenhuma guarnição encontrada" />}

      {list.data && list.data.items.length > 0 && (
        <Panel title="Guarnições" icon={<ShieldCheck className="h-5 w-5" />}>
          <Table headers={[
            "Guarnição", "Viatura", "Comandante", "Integrantes", "Início", "Situação",
            ...(mayDelete ? ["Ações"] : []),
          ]}>
            {list.data.items.map((crew) => (
              <CrewRow key={crew.id} crew={crew} mayDelete={mayDelete} onChanged={list.reload} />
            ))}
          </Table>

          <Pagination page={list.data.page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />
        </Panel>
      )}

      {creating && (
        <CreateCrewModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); list.reload() }}
        />
      )}
    </Page>
  )
}

function CrewRow({ crew, mayDelete, onChanged }: {
  crew: Crew
  mayDelete: boolean
  onChanged: () => void
}) {
  const remove = useMutation(() => crews.remove(crew.id))

  return (
    <Row>
      <Cell className="font-bold">{crew.name}</Cell>
      <Cell>{crew.vehicle?.prefix ?? "—"}</Cell>
      <Cell>
        {crew.commander ? `${RANK_LABEL[crew.commander.rank]} ${crew.commander.war_name}` : "—"}
      </Cell>
      <Cell>
        <div className="flex flex-wrap gap-1">
          {(crew.members ?? []).map((member) => (
            <span key={member.id} className="border border-neutral-300 px-2 py-0.5 text-sm">
              {member.firefighter?.war_name ?? "—"}
              <span className="text-neutral-500"> · {CREW_ROLE_LABEL[member.role]}</span>
            </span>
          ))}
          {(crew.members ?? []).length === 0 && <span className="text-neutral-500">—</span>}
        </div>
      </Cell>
      <Cell className="whitespace-nowrap">{formatDateTime(crew.started_at)}</Cell>
      <Cell>
        <Badge tone={crew.active ? "bg-green-600" : "bg-neutral-500"}>
          {crew.active ? "Em serviço" : "Encerrada"}
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

interface MemberDraft {
  firefighter_id: string
  role: CrewRole
}

function CreateCrewModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const unitList = useResource(() => units.list({ active: true }), [])
  const [unitId, setUnitId] = useState("")

  // Vehicles and firefighters are scoped to the unit so a crew cannot be built
  // out of people and trucks that never share a station.
  const fleet = useResource(
    () => vehicles.list({ unit_id: unitId, per_page: 100 }),
    [unitId],
    { enabled: Boolean(unitId) },
  )

  const roster = useResource(
    () => firefighters.list({ unit_id: unitId, status: "ATIVO", per_page: 100 }),
    [unitId],
    { enabled: Boolean(unitId) },
  )

  const [name, setName] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  const [commanderId, setCommanderId] = useState("")
  const [startedAt, setStartedAt] = useState(toLocalInputValue(new Date()))
  const [members, setMembers] = useState<MemberDraft[]>([{ firefighter_id: "", role: "COMANDANTE" }])

  const create = useMutation(crews.create)

  const rosterOptions = (roster.data?.items ?? []).map((firefighter) => ({
    value: firefighter.id,
    label: `${RANK_LABEL[firefighter.rank]} ${firefighter.war_name}`,
  }))

  function updateMember(index: number, patch: Partial<MemberDraft>) {
    setMembers((current) => current.map((member, i) => (i === index ? { ...member, ...patch } : member)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const created = await create.run({
      name: name.trim(),
      vehicle_id: vehicleId,
      unit_id: unitId,
      commander_id: commanderId,
      started_at: new Date(startedAt).toISOString(),
      members: members.filter((member) => member.firefighter_id),
    })

    if (created) onCreated()
  }

  return (
    <Modal title="Montar guarnição" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {create.error && <ErrorBox message={create.error} />}
        <ErrorDetails details={create.details} />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Unidade" required>
            <Select
              value={unitId}
              onChange={(value) => { setUnitId(value); setVehicleId(""); setCommanderId("") }}
              placeholder={unitList.loading ? "Carregando..." : "Selecione"}
              options={(unitList.data?.items ?? []).map((unit) => ({ value: unit.id, label: `${unit.acronym} — ${unit.name}` }))}
            />
          </Field>

          <Field label="Nome da guarnição" required>
            <TextInput required value={name} onChange={(event) => setName(event.target.value)} placeholder="Guarnição Alfa" />
          </Field>

          <Field label="Viatura" required>
            <Select
              value={vehicleId}
              onChange={setVehicleId}
              disabled={!unitId}
              placeholder={unitId ? "Selecione a viatura" : "Escolha a unidade primeiro"}
              options={(fleet.data?.items ?? []).map((vehicle) => ({ value: vehicle.id, label: `${vehicle.prefix} — ${vehicle.type}` }))}
            />
          </Field>

          <Field label="Comandante" required>
            <Select
              value={commanderId}
              onChange={setCommanderId}
              disabled={!unitId}
              placeholder={unitId ? "Selecione o comandante" : "Escolha a unidade primeiro"}
              options={rosterOptions}
            />
          </Field>

          <Field label="Início do serviço" required>
            <TextInput
              type="datetime-local"
              required
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-bold text-neutral-900">
              <Users className="h-5 w-5" />
              Integrantes
            </p>

            <ActionButton
              tone="neutral"
              type="button"
              className="px-3 py-1 text-sm"
              onClick={() => setMembers((current) => [...current, { firefighter_id: "", role: "COMBATENTE" }])}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </ActionButton>
          </div>

          {members.map((member, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
              <Select
                value={member.firefighter_id}
                onChange={(value) => updateMember(index, { firefighter_id: value })}
                disabled={!unitId}
                placeholder="Selecione o bombeiro"
                options={rosterOptions}
              />

              <Select
                value={member.role}
                onChange={(value) => updateMember(index, { role: value as CrewRole })}
                options={optionsOf(CREW_ROLE_LABEL)}
              />

              <ActionButton
                tone="ghost"
                type="button"
                className="px-3"
                onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}
              >
                Remover
              </ActionButton>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton tone="ghost" type="button" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton tone="primary" type="submit" disabled={create.submitting}>
            {create.submitting ? "Salvando..." : "Criar guarnição"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
