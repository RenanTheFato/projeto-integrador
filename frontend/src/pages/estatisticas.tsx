/**
 * Where the calls come from, and when.
 *
 * Every other screen is about the incident in front of the dispatcher right
 * now. This one is about the record — which parts of the city keep calling,
 * which barely ever do, what they call about, at what hour, how fast the first
 * vehicle gets there, and whether any of that is better or worse than it was
 * last period. It is the screen a commander opens when deciding where a post
 * should be or how a shift should be staffed, not the one an operator watches
 * during a shift.
 *
 * Everything here is computed in the browser from the incident and dispatch
 * lists. That is a deliberate limit, not an oversight: it keeps the backend
 * free of report-shaped endpoints that would each need their own filters,
 * pagination and tests, and it holds comfortably for the thousands of incidents
 * a municipal fire department files in a year. Past that the honest answer is
 * aggregation in SQL, and the screen says so out loud when it hits its ceiling
 * rather than quietly under-reporting.
 */

import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarRange, Clock, Flame, Gauge, MapPinned, Repeat, Timer, TrendingDown, TrendingUp,
} from "lucide-react"

import { ai, dispatches, occurrences, units } from "@/api/endpoints"
import {
  NATURE_LABEL, OCCURRENCE_STATUS_LABEL, PRIORITY_LABEL, optionsOf,
} from "@/api/labels"
import type {
  Occurrence, OccurrenceNature, OccurrencePriority, OccurrenceStatus,
} from "@/api/types"
import { ActionButton, Field, Page, PageHeader, Panel, Select } from "@/components/layout/kit"
import { ErrorBox, LoadingBlock } from "@/components/layout/feedback"
import { HeatGrid, HourHistogram, Ranking, TimeSeries } from "@/components/charts/distribution-charts"
import type { RankingItem, SeriesPoint } from "@/components/charts/distribution-charts"
import IncidentMap, { IncidentLegend, UNIT_COLORS } from "@/components/mapa/incident-map"
import type { IncidentMapMode, IncidentPoint, RecurrenceCluster } from "@/components/mapa/incident-map"
import { useResource } from "@/hooks/use-resource"
import { formatDuration, toNumber } from "@/lib/format"
import { stationsOf } from "@/lib/geo"
import { cn } from "@/lib/utils"

/** Presets, because nobody fights a calendar grid to ask for "last 90 days". */
const PERIODS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "", label: "Todo o histórico" },
]

/** How many rows a ranking shows before it stops being a ranking. */
const RANKING_SIZE = 6

/** An address has to come back this often before it counts as a recurrence. */
const RECURRENCE_MINIMUM = 3

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const DAY_MS = 24 * 60 * 60 * 1000

export default function Estatisticas() {
  const navigate = useNavigate()

  const [period, setPeriod] = useState("365")
  const [nature, setNature] = useState("")
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [mapMode, setMapMode] = useState<IncidentMapMode>("heat")

  const days = Number(period) || 0

  /**
   * "Now", fixed when the screen opens.
   *
   * Read during render instead, the window would slide a few milliseconds on
   * every re-render, and two figures computed on either side of that slide
   * could disagree about which incidents are inside the period. One anchor
   * keeps every number on the page talking about the same window.
   */
  const [now] = useState(() => Date.now())

  // The window under the filters, and the window of the same length ending
  // where this one begins. Every "vs. período anterior" on the page is against
  // that second window, so the comparison is like for like.
  const { from, previousFrom, previousTo } = useMemo(() => {
    if (!days) return { from: undefined, previousFrom: undefined, previousTo: undefined }

    const start = now - days * DAY_MS

    return {
      from: new Date(start).toISOString(),
      previousFrom: new Date(start - days * DAY_MS).toISOString(),
      previousTo: new Date(start).toISOString(),
    }
  }, [days, now])

  const filters = {
    nature: (nature || undefined) as OccurrenceNature | undefined,
    status: (status || undefined) as OccurrenceStatus | undefined,
    priority: (priority || undefined) as OccurrencePriority | undefined,
  }

  const all = useResource(
    () => occurrences.listAll({ from, ...filters }),
    [from, nature, status, priority],
  )

  const earlier = useResource(
    () => previousFrom
      ? occurrences.listAll({ from: previousFrom, to: previousTo, ...filters })
      : Promise.resolve({ items: [], total: 0, truncated: false }),
    [previousFrom, previousTo, nature, status, priority],
  )

  const dispatchList = useResource(() => dispatches.listAll(), [])
  const unitList = useResource(() => units.list({ active: true }), [])
  const model = useResource(() => ai.model(), [])

  const items = useMemo(() => all.data?.items ?? [], [all.data])
  const earlierItems = useMemo(() => earlier.data?.items ?? [], [earlier.data])

  // -- units ------------------------------------------------------------------

  /**
   * Colour per responding post, assigned once by acronym in alphabetical order.
   *
   * Assigning by "order they appear in the data" would repaint the map every
   * time a filter changed which post appears first, and a colour that moves is
   * a colour that teaches nothing.
   */
  const unitColor = useMemo(() => {
    const acronyms = [...new Set((unitList.data?.items ?? []).map((unit) => unit.acronym))].sort()

    return new Map(acronyms.map((acronym, index) => [
      acronym,
      UNIT_COLORS[index % UNIT_COLORS.length],
    ]))
  }, [unitList.data])

  const stations = useMemo(() => stationsOf(unitList.data?.items), [unitList.data])

  // -- map --------------------------------------------------------------------

  const incidents = useMemo<IncidentPoint[]>(
    () => items.flatMap((occurrence) => {
      const latitude = toNumber(occurrence.latitude)
      const longitude = toNumber(occurrence.longitude)
      if (latitude === null || longitude === null) return []

      const acronym = occurrence.unit?.acronym ?? "Sem unidade"

      return [{
        id: occurrence.id,
        protocol: occurrence.protocol,
        nature: occurrence.nature,
        priority: occurrence.priority,
        address: occurrence.address,
        openedAt: occurrence.opened_at,
        latitude,
        longitude,
        unitLabel: acronym,
        unitColor: unitColor.get(acronym) ?? "#55636F",
      }]
    }),
    [items, unitColor],
  )

  // -- recurrences ------------------------------------------------------------

  /**
   * Addresses the department keeps going back to.
   *
   * Grouped by the address text rather than by coordinate, because that is what
   * makes the answer actionable: "eleven calls to the Dutra at km 118" is
   * something a commander can act on, while "eleven calls within 90 metres of
   * this point" is something they have to go and look up first.
   */
  const recurrences = useMemo(() => {
    const groups = new Map<string, {
      address: string
      count: number
      latitudes: number[]
      longitudes: number[]
      natures: Set<string>
      last: number
    }>()

    for (const occurrence of items) {
      const latitude = toNumber(occurrence.latitude)
      const longitude = toNumber(occurrence.longitude)
      if (latitude === null || longitude === null) continue

      const key = occurrence.address.trim().toLocaleLowerCase("pt-BR")
      const group = groups.get(key) ?? {
        address: occurrence.address.trim(),
        count: 0,
        latitudes: [],
        longitudes: [],
        natures: new Set<string>(),
        last: 0,
      }

      group.count += 1
      group.latitudes.push(latitude)
      group.longitudes.push(longitude)
      group.natures.add(NATURE_LABEL[occurrence.nature])
      group.last = Math.max(group.last, new Date(occurrence.opened_at).getTime())

      groups.set(key, group)
    }

    return [...groups.entries()]
      .filter(([, group]) => group.count >= RECURRENCE_MINIMUM)
      .map(([key, group]) => ({
        id: key,
        address: group.address,
        count: group.count,
        // The centroid of the calls, since the same address is typed with
        // slightly different coordinates each time it is opened.
        latitude: average(group.latitudes),
        longitude: average(group.longitudes),
        natures: [...group.natures],
        last: group.last,
      }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const clusters = useMemo<RecurrenceCluster[]>(
    () => recurrences.map((entry) => ({
      id: entry.id,
      label: entry.address,
      latitude: entry.latitude,
      longitude: entry.longitude,
      count: entry.count,
    })),
    [recurrences],
  )

  // -- rankings ---------------------------------------------------------------

  const districts = useMemo(() => rankBy(items, (item) => districtOf(item.address)), [items])
  const natures = useMemo(() => rankBy(items, (item) => NATURE_LABEL[item.nature]), [items])
  const responders = useMemo(
    () => rankBy(items, (item) => item.unit?.acronym ?? "Sem unidade"),
    [items],
  )

  // -- time -------------------------------------------------------------------

  const byHour = useMemo(() => {
    const counts = new Array(24).fill(0) as number[]

    for (const item of items) {
      const opened = new Date(item.opened_at)
      if (!Number.isNaN(opened.getTime())) counts[opened.getHours()] += 1
    }

    return counts
  }, [items])

  const byWeekdayHour = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[])

    for (const item of items) {
      const opened = new Date(item.opened_at)
      if (Number.isNaN(opened.getTime())) continue
      grid[opened.getDay()][opened.getHours()] += 1
    }

    return grid
  }, [items])

  const series = useMemo(() => bucketize(items, days, now), [items, days, now])
  const earlierSeries = useMemo(
    () => bucketize(earlierItems, days, now - days * DAY_MS),
    [earlierItems, days, now],
  )

  // -- response times ---------------------------------------------------------

  /**
   * Minutes from the call landing to the first vehicle arriving.
   *
   * The one number a fire department is actually judged on. It has to be joined
   * together here because the incident carries when the call came in and the
   * dispatch carries when the vehicle arrived, and no endpoint returns both.
   */
  const arrivals = useMemo(() => {
    const openedAt = new Map(items.map((item) => [item.id, new Date(item.opened_at).getTime()]))
    const perIncident = new Map<string, number>()

    for (const dispatch of dispatchList.data?.items ?? []) {
      if (!dispatch.arrived_at) continue

      const opened = openedAt.get(dispatch.occurrence_id)
      if (opened === undefined) continue

      const minutes = (new Date(dispatch.arrived_at).getTime() - opened) / 60000
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 240) continue

      // The first vehicle on scene is the response; a second one arriving an
      // hour later is reinforcement, not a slower response.
      const already = perIncident.get(dispatch.occurrence_id)
      if (already === undefined || minutes < already) {
        perIncident.set(dispatch.occurrence_id, minutes)
      }
    }

    return perIncident
  }, [items, dispatchList.data])

  const responseByNature = useMemo<RankingItem[]>(() => {
    const groups = new Map<string, number[]>()

    for (const item of items) {
      const minutes = arrivals.get(item.id)
      if (minutes === undefined) continue

      const label = NATURE_LABEL[item.nature]
      groups.set(label, [...(groups.get(label) ?? []), minutes])
    }

    return [...groups.entries()]
      .map(([label, values]) => ({
        key: label,
        label,
        value: Math.round(average(values)),
        note: `${values.length} atendimento${values.length === 1 ? "" : "s"} medido${values.length === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
  }, [items, arrivals])

  const averageResponse = useMemo(() => {
    const values = [...arrivals.values()]
    return values.length === 0 ? null : average(values)
  }, [arrivals])

  // -- headline figures -------------------------------------------------------

  const severe = items.filter(isSevere).length
  const earlierSevere = earlierItems.filter(isSevere).length

  const closureMinutes = useMemo(() => averageClosure(items), [items])
  const earlierClosure = useMemo(() => averageClosure(earlierItems), [earlierItems])

  const comparable = Boolean(previousFrom) && !earlier.loading

  const priorities = useMemo(() => {
    const counts = new Map<OccurrencePriority, number>()
    for (const item of items) counts.set(item.priority, (counts.get(item.priority) ?? 0) + 1)
    return counts
  }, [items])

  const statuses = useMemo(() => {
    const counts = new Map<OccurrenceStatus, number>()
    for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
    return counts
  }, [items])

  const periodLabel = PERIODS.find((entry) => entry.value === period)?.label ?? "Recorte"

  // Only the posts that actually answered something in this recorte. Listing
  // every unit in the registry would put the regional command in São Paulo in
  // a legend of colours nothing on the map is wearing.
  const legendUnits = useMemo(
    () => responders.map((entry) => ({
      label: entry.label,
      color: unitColor.get(entry.label) ?? "#55636F",
    })),
    [responders, unitColor],
  )

  return (
    <Page>
      <PageHeader
        title="Estatísticas"
        subtitle="Onde as ocorrências acontecem, quando chegam e quanto tempo levam"
      />

      {/* One row of filters above everything, scoping every number below it. */}
      <Panel title="Recorte" icon={<CalendarRange className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Período">
            <Select value={period} onChange={setPeriod} options={PERIODS} />
          </Field>

          <Field label="Natureza">
            <Select
              value={nature}
              onChange={setNature}
              placeholder="Todas"
              options={optionsOf(NATURE_LABEL)}
            />
          </Field>

          <Field label="Situação">
            <Select
              value={status}
              onChange={setStatus}
              placeholder="Todas"
              options={optionsOf(OCCURRENCE_STATUS_LABEL)}
            />
          </Field>

          <Field label="Prioridade">
            <Select
              value={priority}
              onChange={setPriority}
              placeholder="Todas"
              options={optionsOf(PRIORITY_LABEL)}
            />
          </Field>
        </div>

        <p className="text-sm text-ink-muted">
          {all.loading
            ? "Levantando as ocorrências..."
            : `${items.length.toLocaleString("pt-BR")} ocorrência${items.length === 1 ? "" : "s"} no recorte`}
          {comparable && ` · ${earlierItems.length.toLocaleString("pt-BR")} no período anterior de mesma duração`}
        </p>

        {all.data?.truncated && (
          <p className="rounded-sm border border-warn/30 bg-warn-soft px-4 py-2 text-ink">
            O recorte tem {all.data.total.toLocaleString("pt-BR")} ocorrências e a tela carrega
            até mil. Os números abaixo cobrem as mais recentes — estreite o período para um
            retrato exato.
          </p>
        )}
      </Panel>

      {all.error && <ErrorBox message={all.error} onRetry={all.reload} />}
      {all.loading && !all.data && <LoadingBlock label="Carregando as ocorrências..." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DeltaStat
          icon={<Flame className="h-6 w-6" />}
          label="Ocorrências"
          value={items.length.toLocaleString("pt-BR")}
          current={items.length}
          previous={comparable ? earlierItems.length : null}
          moreIsBetter={false}
        />

        <DeltaStat
          icon={<Gauge className="h-6 w-6" />}
          label="Graves"
          value={severe.toLocaleString("pt-BR")}
          hint="Prioridade alta ou crítica"
          current={severe}
          previous={comparable ? earlierSevere : null}
          moreIsBetter={false}
        />

        <DeltaStat
          icon={<Timer className="h-6 w-6" />}
          label="Tempo médio de resposta"
          value={averageResponse === null ? "—" : formatDuration(averageResponse * 60)}
          hint="Do chamado à chegada da primeira viatura"
          current={averageResponse}
          previous={null}
          moreIsBetter={false}
        />

        <DeltaStat
          icon={<Clock className="h-6 w-6" />}
          label="Tempo médio até encerrar"
          value={closureMinutes === null ? "—" : formatDuration(closureMinutes * 60)}
          hint="Somente ocorrências encerradas"
          current={closureMinutes}
          previous={comparable ? earlierClosure : null}
          moreIsBetter={false}
        />
      </div>

      <Panel
        title="Mapa das ocorrências"
        icon={<MapPinned className="h-5 w-5" />}
        actions={<IncidentLegend mode={mapMode} units={legendUnits} />}
      >
        <IncidentMap
          incidents={incidents}
          clusters={clusters}
          stations={stations}
          coverage={model.data?.bounds ?? null}
          mode={mapMode}
          onModeChange={setMapMode}
          onOpen={(id) => navigate(`/ocorrencias/${id}`)}
          className="h-[58vh] max-h-[700px] min-h-[380px] w-full"
        />

        <p className="text-sm text-ink-muted">
          {MAP_NOTE[mapMode]} Os quartéis aparecem nos quatro modos.
        </p>
      </Panel>

      <Panel title="Volume ao longo do tempo" icon={<TrendingUp className="h-5 w-5" />}>
        <TimeSeries
          current={series}
          previous={comparable && earlierSeries.length === series.length ? earlierSeries : undefined}
          currentLabel={periodLabel}
          previousLabel="Período anterior"
        />
      </Panel>

      <Panel title="Quando os chamados chegam" icon={<Clock className="h-5 w-5" />}>
        <HeatGrid rows={WEEKDAYS} values={byWeekdayHour} />

        <p className="text-sm text-ink-soft">
          Cada célula é um dia da semana cruzado com uma hora do dia. É a distribuição que diz
          em que turno o efetivo precisa estar mais forte — uma noite de sábado e uma noite de
          terça não são a mesma noite.
        </p>

        <HourHistogram counts={byHour} />
      </Panel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Panel title="Onde mais acontece" icon={<TrendingUp className="h-5 w-5" />}>
          <p className="text-sm text-ink-soft">Bairros com mais chamados no recorte.</p>
          <Ranking
            items={districts.slice(0, RANKING_SIZE)}
            emptyMessage="Nenhuma ocorrência no recorte."
          />
        </Panel>

        <Panel title="Onde menos acontece" icon={<TrendingDown className="h-5 w-5" />}>
          <p className="text-sm text-ink-soft">
            A outra ponta da mesma lista — bairros que aparecem, mas raramente.
          </p>
          <Ranking
            items={[...districts].reverse().slice(0, RANKING_SIZE)}
            emptyMessage="Nenhuma ocorrência no recorte."
          />
        </Panel>

        <Panel title="Por natureza" icon={<Flame className="h-5 w-5" />}>
          <Ranking
            items={natures.slice(0, RANKING_SIZE)}
            emptyMessage="Nenhuma ocorrência no recorte."
          />
        </Panel>

        <Panel title="Por quartel que atendeu" icon={<MapPinned className="h-5 w-5" />}>
          <Ranking
            items={responders.slice(0, RANKING_SIZE)}
            emptyMessage="Nenhuma ocorrência no recorte."
          />
        </Panel>
      </div>

      <Panel title="Endereços recorrentes" icon={<Repeat className="h-5 w-5" />}>
        <p className="text-sm text-ink-soft">
          Endereços com {RECURRENCE_MINIMUM} chamados ou mais no recorte. São os pontos onde uma
          vistoria, uma obra ou uma conversa com outro órgão rende mais do que mais uma viatura.
        </p>

        <Ranking
          items={recurrences.slice(0, 8).map((entry) => ({
            key: entry.id,
            label: entry.address,
            value: entry.count,
            note: `${entry.natures.slice(0, 3).join(" · ")} — último em ${new Date(entry.last).toLocaleDateString("pt-BR")}`,
          }))}
          emptyMessage="Nenhum endereço se repetiu o bastante no recorte."
          unit="chamados"
        />
      </Panel>

      <Panel title="Tempo médio de resposta por natureza" icon={<Timer className="h-5 w-5" />}>
        <p className="text-sm text-ink-soft">
          Minutos entre o chamado e a chegada da primeira viatura. Só entram as ocorrências cujo
          despacho registrou a chegada.
        </p>

        <Ranking
          items={responseByNature}
          emptyMessage="Nenhum despacho com chegada registrada no recorte."
          unit="minutos"
        />
      </Panel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Panel title="Por prioridade">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["CRITICA", "ALTA", "MEDIA", "BAIXA"] as OccurrencePriority[]).map((entry) => (
              <Tile key={entry} label={PRIORITY_LABEL[entry]} value={priorities.get(entry) ?? 0} />
            ))}
          </div>
        </Panel>

        <Panel title="Por situação">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(OCCURRENCE_STATUS_LABEL) as OccurrenceStatus[]).map((entry) => (
              <Tile
                key={entry}
                label={OCCURRENCE_STATUS_LABEL[entry]}
                value={statuses.get(entry) ?? 0}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="flex justify-end">
        <ActionButton tone="neutral" onClick={() => { all.reload(); earlier.reload(); dispatchList.reload() }}>
          Recarregar os números
        </ActionButton>
      </div>
    </Page>
  )
}

const MAP_NOTE: Record<IncidentMapMode, string> = {
  heat: "A mancha mostra onde os chamados se concentram — quanto mais escuro, mais ocorrências no mesmo pedaço da cidade.",
  points: "Cada ocorrência é um ponto, colorido pela prioridade e clicável até o registro.",
  coverage: "Cada ocorrência na cor do quartel que a atendeu, o que desenha o território real de cada posto.",
  recurrence: "Só os endereços que voltaram, com o círculo crescendo conforme o número de chamados.",
}

// -- pieces -------------------------------------------------------------------

function Tile({ label, value }: { label: string, value: number }) {
  return (
    <div className="rounded-sm border border-line bg-surface-muted px-4 py-3">
      <p className="label-caps text-ink-soft">{label}</p>
      <p
        className="text-2xl font-semibold text-ink"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * A figure with how it moved against the period before.
 *
 * The arrow's colour is direction times whether up is good, never direction
 * alone: more incidents is not an achievement, and the same green arrow on
 * "ocorrências" and on "viaturas disponíveis" would mean two opposite things.
 */
function DeltaStat({ icon, label, value, hint, current, previous, moreIsBetter }: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  current: number | null
  previous: number | null
  moreIsBetter: boolean
}) {
  const change = current !== null && previous !== null && previous > 0
    ? ((current - previous) / previous) * 100
    : null

  const good = change === null ? null : moreIsBetter ? change > 0 : change < 0

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-line bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2 text-ink-muted">
        {icon}
        <p className="label-caps">{label}</p>
      </div>

      <p
        className="text-3xl font-semibold text-ink"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>

      {change !== null && (
        <p
          className={cn(
            "flex items-center gap-1 text-sm font-semibold",
            good ? "text-ok" : "text-alert",
          )}
        >
          {change > 0
            ? <TrendingUp className="h-4 w-4" />
            : <TrendingDown className="h-4 w-4" />}
          {change > 0 ? "+" : ""}{change.toFixed(1).replace(".", ",")}% vs. período anterior
        </p>
      )}

      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

// -- maths --------------------------------------------------------------------

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const isSevere = (item: Occurrence) =>
  item.priority === "ALTA" || item.priority === "CRITICA"

/** Mean minutes from opening to closing, over the incidents that closed. */
function averageClosure(items: Occurrence[]): number | null {
  const durations = items.flatMap((item) => {
    if (!item.closed_at || item.status !== "ENCERRADA") return []

    const minutes = (new Date(item.closed_at).getTime() - new Date(item.opened_at).getTime()) / 60000
    return Number.isFinite(minutes) && minutes > 0 ? [minutes] : []
  })

  return durations.length === 0 ? null : average(durations)
}

/**
 * The period cut into buckets of a readable width.
 *
 * A year by day is 365 points of noise on a chart 600 pixels wide; a month by
 * week is four. The bucket follows the span so the line always has somewhere
 * between a dozen and forty points on it.
 */
function bucketize(items: Occurrence[], days: number, end: number): SeriesPoint[] {
  const span = days || 365
  const bucketDays = span <= 45 ? 1 : span <= 120 ? 7 : span <= 200 ? 14 : 30
  const buckets = Math.max(2, Math.ceil(span / bucketDays))

  const counts = new Array(buckets).fill(0) as number[]

  for (const item of items) {
    const time = new Date(item.opened_at).getTime()
    if (Number.isNaN(time)) continue

    const back = (end - time) / DAY_MS
    const index = buckets - 1 - Math.floor(back / bucketDays)

    if (index >= 0 && index < buckets) counts[index] += 1
  }

  const format = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })

  return counts.map((value, index) => ({
    label: format.format(new Date(end - (buckets - 1 - index) * bucketDays * DAY_MS)),
    value,
  }))
}

/**
 * The neighbourhood an address belongs to, guessed from the text.
 *
 * There is no district column — the address is one free-text field the operator
 * types. What the form asks for looks like "Rua Jacques Félix, 451, Centro,
 * Taubaté", so dropping the house number and the city usually leaves the
 * neighbourhood last. It is a heuristic, and it is wrong on a malformed
 * address, which is why one it cannot read is counted as "Não informado"
 * instead of quietly being filed under its street name.
 */
function districtOf(address: string): string {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean)

  const meaningful = parts.filter((part) =>
    !/^\d+[a-z]?$/i.test(part)
    && !/^s\/?n$/i.test(part)
    && !/^km\s*\d+/i.test(part)
    && !/^taubat[ée]$/i.test(part)
    && !/^s(ão|ao)\s+paulo$/i.test(part)
    && !/^sp$/i.test(part)
    && !/^\d{5}-?\d{3}$/.test(part))

  // Only the street survived, so there was never a neighbourhood in the text.
  if (meaningful.length <= 1) return "Não informado"

  return meaningful[meaningful.length - 1]
}

function rankBy(items: Occurrence[], keyOf: (item: Occurrence) => string): RankingItem[] {
  const counts = new Map<string, number>()

  for (const item of items) {
    const key = keyOf(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ key: label, label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
}
