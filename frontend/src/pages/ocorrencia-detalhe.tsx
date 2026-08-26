/**
 * One incident, end to end.
 *
 * This is where the project's thesis becomes visible: the route the network
 * chose and the shortest route in metres are drawn on the same map and put
 * side by side in numbers, for the very dispatch that was sent.
 */

import { useCallback, useState } from "react"
import type { FormEvent } from "react"
import { ArrowLeft, Brain, MapPin, Pencil, Route as RouteIcon, Send, Truck } from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { crews, dispatches, occurrences, vehicles } from "@/api/endpoints"
import {
  DISPATCH_NEXT_STATUSES, DISPATCH_STATUS_LABEL, DISPATCH_STATUS_TONE,
  NATURE_LABEL, OCCURRENCE_NEXT_STATUSES, OCCURRENCE_STATUS_LABEL, OCCURRENCE_STATUS_TONE,
  PRIORITY_LABEL, PRIORITY_TONE, VEHICLE_TYPE_LABEL, optionsOf,
} from "@/api/labels"
import type {
  Dispatch, DispatchStatus, Occurrence, OccurrencePriority, OccurrenceStatus, RouteVariant,
} from "@/api/types"
import {
  ActionButton, Badge, ConfirmButton, Field, Modal, Page, PageHeader, Panel, Select,
  TextArea, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, ErrorDetails, FullPageSpinner } from "@/components/layout/feedback"
import RouteMap from "@/components/mapa/route-map"
import { OccurrenceAvatar } from "@/components/occurrence-icon"
import { useRealtime } from "@/hooks/use-realtime"
import { useMutation, useResource } from "@/hooks/use-resource"
import {
  formatCoordinate, formatDateTime, formatDistance, formatDuration, formatElapsed,
} from "@/lib/format"

export default function OcorrenciaDetalhe() {
  const { id = "" } = useParams()
  const [dispatching, setDispatching] = useState(false)
  const [editing, setEditing] = useState(false)

  const detail = useResource(() => occurrences.get(id), [id], { enabled: Boolean(id) })
  const reload = detail.reload

  useRealtime(useCallback((event) => {
    const touchesThis =
      (event.type === "occurrence.updated" && event.payload.id === id) ||
      (event.type === "dispatch.created" && event.payload.occurrence_id === id) ||
      (event.type === "dispatch.updated" && event.payload.occurrence_id === id)

    if (touchesThis) reload()
  }, [id, reload]))

  // Declared before the early returns below: hooks cannot be conditional.
  const changeStatus = useMutation(
    (status: OccurrenceStatus) => occurrences.update(id, { status }),
  )

  if (detail.loading && !detail.data) return <FullPageSpinner label="Carregando ocorrência..." />
  if (detail.error) return <Page><ErrorBox message={detail.error} onRetry={detail.reload} /></Page>
  if (!detail.data) return null

  const occurrence = detail.data
  const dispatchList = occurrence.dispatches ?? []

  // The map shows the newest dispatch, which is the one being driven now.
  const current = dispatchList[dispatchList.length - 1] ?? null
  const neural = current?.routes?.find((route) => route.algorithm === "NEURAL") ?? null
  const shortest = current?.routes?.find((route) => route.algorithm === "DIJKSTRA") ?? null

  const closed = occurrence.status === "ENCERRADA" || occurrence.status === "CANCELADA"

  return (
    <Page>
      <Link to="/ocorrencias" className="flex w-fit items-center gap-1 font-semibold text-neutral-700 hover:text-black">
        <ArrowLeft className="h-4 w-4" />
        Voltar para as ocorrências
      </Link>

      <PageHeader
        title={`Ocorrência ${occurrence.protocol}`}
        subtitle={`${NATURE_LABEL[occurrence.nature]} — aberta ${formatElapsed(occurrence.opened_at)}`}
        actions={!closed && (
          <>
            <ActionButton tone="neutral" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Editar
            </ActionButton>

            {OCCURRENCE_NEXT_STATUSES[occurrence.status].map((status) => (
              <ConfirmButton
                key={status}
                label={status === "ENCERRADA" ? "Encerrar" : "Cancelar ocorrência"}
                confirmLabel={status === "ENCERRADA" ? "Confirmar encerramento" : "Confirmar cancelamento"}
                disabled={changeStatus.submitting}
                onConfirm={async () => {
                  const updated = await changeStatus.run(status)
                  if (updated) detail.reload()
                }}
              />
            ))}

            <ActionButton tone="primary" onClick={() => setDispatching(true)}>
              <Send className="h-5 w-5" />
              Despachar viatura
            </ActionButton>
          </>
        )}
      />

      {changeStatus.error && <ErrorBox message={changeStatus.error} />}

      <div className={`flex items-center gap-4 border px-5 py-4 ${PRIORITY_TONE[occurrence.priority]}`}>
        <OccurrenceAvatar nature={occurrence.nature} size="lg" />

        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-white">{NATURE_LABEL[occurrence.nature]}</p>
          <p className="text-white/90">{occurrence.address}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge tone={OCCURRENCE_STATUS_TONE[occurrence.status]}>
            {OCCURRENCE_STATUS_LABEL[occurrence.status]}
          </Badge>
          <span className="font-semibold text-white">Prioridade {PRIORITY_LABEL[occurrence.priority]}</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-5">
          <Panel title="Detalhes" icon={<MapPin className="h-5 w-5" />}>
            <Detail term="Solicitante" value={occurrence.caller_name ?? "Não informado"} />
            <Detail term="Telefone" value={occurrence.caller_phone ?? "Não informado"} />
            <Detail term="Unidade responsável" value={occurrence.unit ? `${occurrence.unit.acronym} — ${occurrence.unit.name}` : "—"} />
            <Detail term="Aberta em" value={formatDateTime(occurrence.opened_at)} />
            {occurrence.closed_at && <Detail term="Encerrada em" value={formatDateTime(occurrence.closed_at)} />}
            <Detail
              term="Coordenadas"
              value={`${formatCoordinate(occurrence.latitude)}, ${formatCoordinate(occurrence.longitude)}`}
            />

            <div className="pt-1">
              <p className="font-bold text-neutral-900">Relato</p>
              <p className="mt-1 whitespace-pre-line text-neutral-800">{occurrence.description}</p>
            </div>
          </Panel>

          <RouteComparison neural={neural} shortest={shortest} />
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Rota calculada" icon={<RouteIcon className="h-5 w-5" />} className="min-h-[420px]">
            <RouteMap
              route={neural?.geometry ?? null}
              comparison={shortest?.geometry ?? null}
              originLabel="Saída da viatura"
              destinationLabel={`Ocorrência ${occurrence.protocol}`}
              className="h-[420px] w-full"
              emptyMessage="Nenhum despacho com rota calculada para esta ocorrência."
            />
          </Panel>

          <Panel title="Despachos" icon={<Truck className="h-5 w-5" />}>
            {dispatchList.length === 0 && (
              <EmptyState
                title="Nenhuma viatura despachada"
                description="Despache uma viatura para que a rota seja calculada pela rede neural."
              />
            )}

            <div className="flex flex-col gap-3">
              {dispatchList.map((dispatch) => (
                <DispatchCard key={dispatch.id} dispatch={dispatch} onChanged={detail.reload} />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {editing && (
        <EditOccurrenceModal
          occurrence={occurrence}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); detail.reload() }}
        />
      )}

      {dispatching && (
        <DispatchModal
          occurrence={occurrence}
          onClose={() => setDispatching(false)}
          onDispatched={() => { setDispatching(false); detail.reload() }}
        />
      )}
    </Page>
  )
}

function Detail({ term, value }: { term: string, value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 pb-1.5">
      <span className="text-neutral-600">{term}</span>
      <span className="font-semibold text-neutral-900">{value}</span>
    </div>
  )
}

/**
 * The side-by-side the project exists to demonstrate. The gain is stated in
 * seconds and in percent, and it is honest about a negative result: if the
 * network picked a slower path, that is what the panel says.
 */
function RouteComparison({ neural, shortest }: { neural: RouteVariant | null, shortest: RouteVariant | null }) {
  if (!neural || !shortest) {
    return (
      <Panel title="Comparação de rotas" icon={<Brain className="h-5 w-5" />}>
        <p className="text-neutral-600">
          A comparação aparece assim que uma viatura for despachada e a rede neural responder.
        </p>
      </Panel>
    )
  }

  const savedSeconds = shortest.estimated_time_seconds - neural.estimated_time_seconds
  const percent = shortest.estimated_time_seconds > 0
    ? (savedSeconds / shortest.estimated_time_seconds) * 100
    : 0

  return (
    <Panel title="Comparação de rotas" icon={<Brain className="h-5 w-5" />}>
      <div className="grid grid-cols-2 gap-3">
        <Variant title="Rede neural" accent="border-[#E53935]" route={neural} />
        <Variant title="Menor distância" accent="border-[#1565C0]" route={shortest} />
      </div>

      <div className="border bg-[#F5EFE6] px-4 py-3">
        {savedSeconds > 0 ? (
          <p className="text-neutral-900">
            A rota da rede neural chega{" "}
            <strong className="text-green-700">{formatDuration(savedSeconds)} antes</strong>{" "}
            ({percent.toFixed(1).replace(".", ",")}% mais rápida), percorrendo{" "}
            {formatDistance(neural.distance_meters - shortest.distance_meters)} a mais.
          </p>
        ) : savedSeconds < 0 ? (
          <p className="text-neutral-900">
            Neste trajeto a rota mais curta em metros foi{" "}
            <strong className="text-[#DE5656]">{formatDuration(Math.abs(savedSeconds))} mais rápida</strong>{" "}
            que a escolhida pela rede.
          </p>
        ) : (
          <p className="text-neutral-900">As duas rotas levam o mesmo tempo estimado.</p>
        )}

        {neural.model_version && (
          <p className="mt-1 text-sm text-neutral-600">
            Modelo <span className="font-mono">{neural.model_version}</span>
          </p>
        )}
      </div>
    </Panel>
  )
}

function Variant({ title, accent, route }: { title: string, accent: string, route: RouteVariant }) {
  return (
    <div className={`flex flex-col gap-1 border-l-4 bg-white px-3 py-2 ${accent}`}>
      <p className="font-bold text-neutral-900">{title}</p>
      <p className="text-2xl font-bold text-neutral-900">{formatDuration(route.estimated_time_seconds)}</p>
      <p className="text-neutral-700">{formatDistance(route.distance_meters)}</p>
      <p className="text-sm text-neutral-500">{route.node_count} cruzamentos</p>
    </div>
  )
}

function DispatchCard({ dispatch, onChanged }: { dispatch: Dispatch, onChanged: () => void }) {
  const advance = useMutation((status: DispatchStatus) => dispatches.updateStatus(dispatch.id, status))
  const next = DISPATCH_NEXT_STATUSES[dispatch.status]

  async function handleAdvance(status: DispatchStatus) {
    const updated = await advance.run(status)
    if (updated) onChanged()
  }

  return (
    <div className="flex flex-col gap-3 border bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-neutral-900">
            {dispatch.vehicle?.prefix ?? "Viatura"}
            {dispatch.vehicle && (
              <span className="ml-2 text-sm font-normal text-neutral-600">
                {VEHICLE_TYPE_LABEL[dispatch.vehicle.type]}
              </span>
            )}
          </p>
          <p className="text-sm text-neutral-600">
            Despachada em {formatDateTime(dispatch.dispatched_at)}
          </p>
        </div>

        <Badge tone={DISPATCH_STATUS_TONE[dispatch.status]}>
          {DISPATCH_STATUS_LABEL[dispatch.status]}
        </Badge>
      </div>

      {dispatch.crew && (
        <p className="text-sm text-neutral-700">
          Guarnição <strong>{dispatch.crew.name}</strong>
          {dispatch.crew.commander && ` — comandante ${dispatch.crew.commander.war_name}`}
        </p>
      )}

      {advance.error && <ErrorBox message={advance.error} />}

      {next.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {next.map((status) => (
            <ActionButton
              key={status}
              tone={status === "CANCELADO" ? "ghost" : "neutral"}
              className="px-3 py-1.5 text-sm"
              disabled={advance.submitting}
              onClick={() => handleAdvance(status)}
            >
              {DISPATCH_STATUS_LABEL[status]}
            </ActionButton>
          ))}
        </div>
      )}
    </div>
  )
}

function DispatchModal({ occurrence, onClose, onDispatched }: {
  occurrence: Occurrence
  onClose: () => void
  onDispatched: () => void
}) {
  const fleet = useResource(() => vehicles.list({ status: "DISPONIVEL", per_page: 100 }), [])
  const [vehicleId, setVehicleId] = useState("")
  const [crewId, setCrewId] = useState("")

  // Only the crews already assigned to the chosen vehicle can be sent with it,
  // which is exactly what the backend enforces.
  const crewList = useResource(
    () => crews.list({ vehicle_id: vehicleId, active: true, per_page: 50 }),
    [vehicleId],
    { enabled: Boolean(vehicleId) },
  )

  const send = useMutation(dispatches.create)
  const [warning, setWarning] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const result = await send.run({
      occurrence_id: occurrence.id,
      vehicle_id: vehicleId,
      crew_id: crewId || undefined,
    })

    if (!result) return

    // A dispatch without routes means the AI was unreachable. The vehicle is
    // on its way regardless, so this is a warning, not a failure.
    if (result.routes.length === 0) {
      setWarning(result.message ?? "Viatura despachada, mas a rota não pôde ser calculada.")
      window.setTimeout(onDispatched, 2500)
      return
    }

    onDispatched()
  }

  return (
    <Modal title={`Despachar para ${occurrence.protocol}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {send.error && <ErrorBox message={send.error} />}
        <ErrorDetails details={send.details} />

        {warning && (
          <div className="border border-[#E8A240] bg-[#E8A240]/15 px-4 py-3 text-neutral-900">
            {warning}
          </div>
        )}

        <Field label="Viatura disponível" required>
          <Select
            value={vehicleId}
            onChange={(value) => { setVehicleId(value); setCrewId("") }}
            placeholder={fleet.loading ? "Carregando..." : "Selecione a viatura"}
            options={(fleet.data?.items ?? []).map((vehicle) => ({
              value: vehicle.id,
              label: `${vehicle.prefix} — ${VEHICLE_TYPE_LABEL[vehicle.type]}`,
            }))}
          />
        </Field>

        {fleet.data && fleet.data.items.length === 0 && (
          <p className="text-[#DE5656]">Nenhuma viatura disponível no momento.</p>
        )}

        <Field label="Guarnição" hint="Opcional — apenas guarnições ligadas à viatura escolhida">
          <Select
            value={crewId}
            onChange={setCrewId}
            placeholder={vehicleId ? "Sem guarnição definida" : "Escolha a viatura primeiro"}
            disabled={!vehicleId}
            options={(crewList.data?.items ?? []).map((crew) => ({ value: crew.id, label: crew.name }))}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton tone="ghost" type="button" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton tone="primary" type="submit" disabled={send.submitting || !vehicleId}>
            {send.submitting ? "Despachando..." : "Confirmar despacho"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Editing is limited to what `UpdateOccurrenceService` accepts: the priority,
 * the address and the report. Nature and coordinates are immutable — a wrong
 * one is a different incident, not an edit.
 */
function EditOccurrenceModal({ occurrence, onClose, onSaved }: {
  occurrence: Occurrence
  onClose: () => void
  onSaved: () => void
}) {
  const [priority, setPriority] = useState<string>(occurrence.priority)
  const [address, setAddress] = useState(occurrence.address)
  const [description, setDescription] = useState(occurrence.description)

  const save = useMutation(() => occurrences.update(occurrence.id, {
    priority: priority as OccurrencePriority,
    address: address.trim(),
    description: description.trim(),
  }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const updated = await save.run(undefined)
    if (updated) onSaved()
  }

  return (
    <Modal title={`Editar ${occurrence.protocol}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {save.error && <ErrorBox message={save.error} />}
        <ErrorDetails details={save.details} />

        <Field label="Prioridade" required>
          <Select value={priority} onChange={setPriority} options={optionsOf(PRIORITY_LABEL)} />
        </Field>

        <Field label="Endereço" required>
          <TextInput required value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>

        <Field label="Relato" required>
          <TextArea required value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton tone="ghost" type="button" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton tone="primary" type="submit" disabled={save.submitting}>
            {save.submitting ? "Salvando..." : "Salvar"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
