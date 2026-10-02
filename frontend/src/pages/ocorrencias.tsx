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
import { Link, useSearchParams } from "react-router-dom"

import { ai, geo, occurrences, units } from "@/api/endpoints"
import {
  NATURE_LABEL, OCCURRENCE_STATUS_LABEL, OCCURRENCE_STATUS_TONE,
  PRIORITY_LABEL, PRIORITY_TEXT_TONE, PRIORITY_TONE, optionsOf,
} from "@/api/labels"
import type { Occurrence, OccurrenceNature, OccurrencePriority, OccurrenceStatus } from "@/api/types"
import {
  ActionButton, Badge, Field, FieldButton, Modal, Page, PageHeader, Pagination, Panel, Select,
  TextArea, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, ErrorDetails, LoadingBlock } from "@/components/layout/feedback"
import RouteMap from "@/components/mapa/route-map"
import { OccurrenceAvatar } from "@/components/occurrence-icon"
import { AddressSearch } from "@/components/occurrence/address-search"
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
  // `?nova=1` opens the form straight away: it is where the keyboard shortcut
  // and the command palette land when a call comes in.
  const [searchParams, setSearchParams] = useSearchParams()
  const [creatingState, setCreatingState] = useState(false)
  const creating = creatingState || searchParams.get("nova") === "1"
  const setCreating = useCallback((value: boolean) => {
    setCreatingState(value)
    if (!value && searchParams.has("nova")) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
      className="flex min-w-0 flex-col rounded-sm border border-line bg-surface transition-colors hover:border-accent/50 hover:bg-accent-soft sm:flex-row"
    >
      {/* Severity is a rail, not a fill. Fifteen filled cards is a wall of
          colour that says nothing; fifteen rails are a column the eye can run
          down and find the worst call in. */}
      <span
        aria-hidden
        className={`h-1.5 w-full shrink-0 sm:h-auto sm:w-1.5 ${PRIORITY_TONE[occurrence.priority]}`}
      />

      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
        <OccurrenceAvatar nature={occurrence.nature} tone={PRIORITY_TEXT_TONE[occurrence.priority]} />

        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{NATURE_LABEL[occurrence.nature]}</p>
          <p className="truncate text-sm text-ink-muted">{occurrence.address}</p>
          <p className="text-xs text-ink-soft">
            {formatShort(occurrence.opened_at)} — {formatElapsed(occurrence.opened_at)}
          </p>
        </div>
      </div>

      {/* On a phone the protocol column sits under the card instead of
          squeezing the address into a couple of characters. */}
      <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 border-t border-line px-4 py-3 sm:w-44 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:px-4 sm:py-4">
        <span className="font-mono text-xs text-ink-soft">{occurrence.protocol}</span>
        <Badge tone={OCCURRENCE_STATUS_TONE[occurrence.status]}>
          {OCCURRENCE_STATUS_LABEL[occurrence.status]}
        </Badge>
        <span className={`label-caps ${PRIORITY_TEXT_TONE[occurrence.priority]}`}>
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
  const [addressFromMap, setAddressFromMap] = useState(false)
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

        <Field label="Endereço" required hint="Digite a rua e escolha na lista: o ponto vai para o mapa">
          <AddressSearch
            required
            value={address}
            onChange={(value) => { setAddress(value); setAddressFromMap(false) }}
            onPick={(place) => {
              setLatitude(place.latitude.toFixed(6))
              setLongitude(place.longitude.toFixed(6))
            }}
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
            // A click on the map fills the address too, unless the operator
            // already typed one of their own.
            if (address.trim() === "" || addressFromMap) {
              geo.reverse(pickedLatitude, pickedLongitude)
                .then((place) => {
                  if (place) { setAddress(place.label); setAddressFromMap(true) }
                })
                .catch(() => undefined)
            }
          }}
          pin={pointValid ? { ...point, label: "Local da ocorrência" } : null}
          stations={stations}
          selectedStationId={unitId}
          nearestStationId={nearest?.item.id ?? null}
          onStationSelect={setUnitId}
          className="h-[220px] w-full sm:h-[300px] lg:h-[340px]"
        />

        {nearest && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-accent/30 bg-accent-soft px-4 py-2 text-ink">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <span>
              Quartel mais próximo do local: <strong>{nearest.item.acronym}</strong> —{" "}
              {nearest.item.name}, a {formatDistance(nearest.meters)} em linha reta.
            </span>
            {nearest.item.id === unitId
              ? <span className="text-sm font-semibold text-accent">Já é a unidade responsável.</span>
              : (
                <button
                  type="button"
                  onClick={() => setUnitId(nearest.item.id)}
                  className="text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-strong"
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
