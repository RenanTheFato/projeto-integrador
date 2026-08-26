/**
 * The incident list — the screen a dispatcher lives on.
 *
 * The first version rendered seven identical coloured cards written by hand.
 * The card survived; what feeds it is now the API, with the severity colour
 * driven by the priority the backend stores.
 */

import { useCallback, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Filter, MapPin, Plus, Search } from "lucide-react"
import { Link } from "react-router-dom"

import { ai, occurrences, units } from "@/api/endpoints"
import {
  NATURE_LABEL, OCCURRENCE_STATUS_LABEL, OCCURRENCE_STATUS_TONE,
  PRIORITY_LABEL, PRIORITY_TONE, optionsOf,
} from "@/api/labels"
import type { Occurrence, OccurrenceNature, OccurrencePriority, OccurrenceStatus } from "@/api/types"
import {
  ActionButton, Badge, Field, FieldButton, Modal, Page, PageHeader, Pagination, Panel, Select,
  TextArea, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, ErrorDetails, LoadingBlock } from "@/components/layout/feedback"
import RouteMap from "@/components/mapa/route-map"
import { OccurrenceAvatar } from "@/components/occurrence-icon"
import { useRealtime } from "@/hooks/use-realtime"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatDistance, formatElapsed, formatShort } from "@/lib/format"
import { nearestTo, stationsOf } from "@/lib/geo"

const PER_PAGE = 12

export default function Ocorrencias() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [nature, setNature] = useState("")
  const [priority, setPriority] = useState("")
  const [search, setSearch] = useState("")
  const [applied, setApplied] = useState("")
  const [creating, setCreating] = useState(false)

  const list = useResource(
    () => occurrences.list({
      page,
      per_page: PER_PAGE,
      status: (status || undefined) as OccurrenceStatus | undefined,
      nature: (nature || undefined) as OccurrenceNature | undefined,
      priority: (priority || undefined) as OccurrencePriority | undefined,
      search: applied || undefined,
    }),
    [page, status, nature, priority, applied],
  )

  const reload = list.reload

  // A new incident has to appear without the dispatcher reaching for refresh.
  useRealtime(useCallback((event) => {
    if (event.type === "occurrence.created" || event.type === "occurrence.updated") reload()
  }, [reload]))

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setApplied(search.trim())
  }

  return (
    <Page>
      <PageHeader
        title="Ocorrências"
        subtitle="Chamados registrados e seu andamento"
        actions={
          <ActionButton tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" />
            Nova ocorrência
          </ActionButton>
        }
      />

      <Panel title="Filtros" icon={<Filter className="h-5 w-5" />}>
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Situação">
            <Select
              value={status}
              onChange={(value) => { setStatus(value); setPage(1) }}
              placeholder="Todas"
              options={optionsOf(OCCURRENCE_STATUS_LABEL)}
            />
          </Field>

          <Field label="Natureza">
            <Select
              value={nature}
              onChange={(value) => { setNature(value); setPage(1) }}
              placeholder="Todas"
              options={optionsOf(NATURE_LABEL)}
            />
          </Field>

          <Field label="Prioridade">
            <Select
              value={priority}
              onChange={(value) => { setPriority(value); setPage(1) }}
              placeholder="Todas"
              options={optionsOf(PRIORITY_LABEL)}
            />
          </Field>

          <Field label="Busca">
            <TextInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Protocolo, endereço ou descrição"
            />
          </Field>

          <FieldButton>
            <ActionButton tone="neutral" type="submit" className="w-full py-2">
              <Search className="h-4 w-4" />
              Buscar
            </ActionButton>
          </FieldButton>
        </form>
      </Panel>

      {list.loading && !list.data && <LoadingBlock label="Carregando ocorrências..." />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}

      {list.data && list.data.items.length === 0 && (
        <EmptyState
          title="Nenhuma ocorrência encontrada"
          description="Ajuste os filtros ou registre um novo chamado."
          action={<ActionButton tone="primary" onClick={() => setCreating(true)}><Plus className="h-5 w-5" /> Nova ocorrência</ActionButton>}
        />
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {(list.data?.items ?? []).map((occurrence) => (
          <OccurrenceCard key={occurrence.id} occurrence={occurrence} />
        ))}
      </div>

      {list.data && (
        <Pagination page={list.data.page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />
      )}

      {creating && (
        <CreateOccurrenceModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); list.reload() }}
        />
      )}
    </Page>
  )
}

function OccurrenceCard({ occurrence }: { occurrence: Occurrence }) {
  return (
    <Link
      to={`/ocorrencias/${occurrence.id}`}
      className="flex flex-col border bg-white transition hover:shadow-lg sm:flex-row"
    >
      <div className={`flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 ${PRIORITY_TONE[occurrence.priority]} min-w-0 flex-1`}>
        <OccurrenceAvatar nature={occurrence.nature} />

        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">{NATURE_LABEL[occurrence.nature]}</p>
          <p className="truncate text-white/90">{occurrence.address}</p>
          <p className="text-sm text-white/80">
            {formatShort(occurrence.opened_at)} — {formatElapsed(occurrence.opened_at)}
          </p>
        </div>
      </div>

      {/* On a phone the protocol column sits under the card instead of
          squeezing the address into a couple of characters. */}
      <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:w-40 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-3 sm:py-4">
        <span className="font-mono text-sm text-neutral-600">{occurrence.protocol}</span>
        <Badge tone={OCCURRENCE_STATUS_TONE[occurrence.status]}>
          {OCCURRENCE_STATUS_LABEL[occurrence.status]}
        </Badge>
        <span className="text-sm font-semibold text-neutral-700">
          {PRIORITY_LABEL[occurrence.priority]}
        </span>
      </div>
    </Link>
  )
}

function CreateOccurrenceModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const unitList = useResource(() => units.list({ active: true }), [])
  const model = useResource(() => ai.model(), [])

  const [nature, setNature] = useState<string>("INCENDIO_EDIFICACAO")
  const [priority, setPriority] = useState<string>("ALTA")
  const [unitId, setUnitId] = useState("")
  const [address, setAddress] = useState("")
  const [latitude, setLatitude] = useState("-23.0264")
  const [longitude, setLongitude] = useState("-45.5551")
  const [description, setDescription] = useState("")
  const [callerName, setCallerName] = useState("")
  const [callerPhone, setCallerPhone] = useState("")

  const create = useMutation(occurrences.create)

  const stations = useMemo(() => stationsOf(unitList.data?.items), [unitList.data])

  const point = { latitude: Number(latitude), longitude: Number(longitude) }
  const pointValid =
    latitude.trim() !== "" && longitude.trim() !== ""
    && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)

  // The unit that answers a call is normally the one that can get there first,
  // so the form offers the nearest station instead of leaving the operator to
  // work it out from a dropdown of acronyms.
  const nearest = useMemo(
    () => (pointValid ? nearestTo(point, stations) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pointValid, point.latitude, point.longitude, stations],
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const created = await create.run({
      nature: nature as OccurrenceNature,
      priority: priority as OccurrencePriority,
      description: description.trim(),
      address: address.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      unit_id: unitId,
      caller_name: callerName.trim() || undefined,
      caller_phone: callerPhone.trim() || undefined,
    })

    if (created) onCreated()
  }

  return (
    <Modal title="Registrar ocorrência" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {create.error && <ErrorBox message={create.error} />}
        <ErrorDetails details={create.details} />

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Natureza" required>
            <Select value={nature} onChange={setNature} options={optionsOf(NATURE_LABEL)} />
          </Field>

          <Field label="Prioridade" required>
            <Select value={priority} onChange={setPriority} options={optionsOf(PRIORITY_LABEL)} />
          </Field>

          <Field label="Unidade responsável" required>
            <Select
              value={unitId}
              onChange={setUnitId}
              placeholder={unitList.loading ? "Carregando..." : "Selecione"}
              options={(unitList.data?.items ?? []).map((unit) => ({
                value: unit.id,
                label: `${unit.acronym} — ${unit.name}`,
              }))}
            />
          </Field>
        </div>

        <Field label="Endereço" required>
          <TextInput
            required
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Rua Jacques Félix, 451, Centro, Taubaté"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Latitude" required hint="Precisa cair dentro da malha de Taubaté">
            <TextInput required value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </Field>

          <Field label="Longitude" required>
            <TextInput required value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </Field>
        </div>

        {/* Typing coordinates blind is how an incident ends up in the middle of
            a field. The map shows where the point landed and where the stations
            are around it, and a click moves the point. */}
        <RouteMap
          route={null}
          coverage={model.data?.bounds ?? null}
          onPick={(pickedLatitude, pickedLongitude) => {
            setLatitude(pickedLatitude.toFixed(6))
            setLongitude(pickedLongitude.toFixed(6))
          }}
          pin={pointValid ? { ...point, label: "Local da ocorrência" } : null}
          stations={stations}
          selectedStationId={unitId}
          nearestStationId={nearest?.item.id ?? null}
          onStationSelect={setUnitId}
          className="h-[220px] w-full sm:h-[300px] lg:h-[340px]"
        />

        {nearest && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-[#1565C0] bg-[#1565C0]/10 px-4 py-2 text-neutral-900">
            <MapPin className="h-4 w-4 shrink-0 text-[#1565C0]" />
            <span>
              Quartel mais próximo do local: <strong>{nearest.item.acronym}</strong> —{" "}
              {nearest.item.name}, a {formatDistance(nearest.meters)} em linha reta.
            </span>
            {nearest.item.id === unitId
              ? <span className="text-sm font-semibold text-[#1565C0]">Já é a unidade responsável.</span>
              : (
                <button
                  type="button"
                  onClick={() => setUnitId(nearest.item.id)}
                  className="text-sm font-semibold text-[#1565C0] underline underline-offset-2 hover:text-[#0f4c8f]"
                >
                  Definir como unidade responsável
                </button>
              )}
          </p>
        )}

        <Field label="Descrição" required hint="O que o solicitante relatou">
          <TextArea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Fogo em residência de dois andares, com vítimas no interior"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do solicitante">
            <TextInput value={callerName} onChange={(event) => setCallerName(event.target.value)} />
          </Field>

          <Field label="Telefone do solicitante">
            <TextInput
              value={callerPhone}
              onChange={(event) => setCallerPhone(event.target.value)}
              placeholder="12991110000"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <ActionButton tone="ghost" type="button" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton tone="primary" type="submit" disabled={create.submitting}>
            {create.submitting ? "Registrando..." : "Registrar ocorrência"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
