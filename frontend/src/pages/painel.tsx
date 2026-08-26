/**
 * The dispatcher's home screen.
 *
 * The first version showed the same four figures from hard-coded values. They
 * now come from the API, and the live feed refreshes them as incidents are
 * opened and vehicles are committed, because a number that goes stale during a
 * shift is worse than no number at all.
 */

import { useCallback, useState } from "react"
import { Activity, Brain, Car, Clock, Radio, TriangleAlert, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { ai, dispatches, firefighters, occurrences, vehicles } from "@/api/endpoints"
import {
  NATURE_LABEL, OCCURRENCE_STATUS_LABEL, OCCURRENCE_STATUS_TONE,
  PRIORITY_LABEL, PRIORITY_TEXT_TONE, PRIORITY_TONE,
} from "@/api/labels"
import type { Occurrence } from "@/api/types"
import { Badge, Page, PageHeader, Panel, StatBox } from "@/components/layout/kit"
import { EmptyState, ErrorBox, LoadingBlock } from "@/components/layout/feedback"
import { OccurrenceAvatar } from "@/components/occurrence-icon"
import { useRealtime } from "@/hooks/use-realtime"
import { useResource } from "@/hooks/use-resource"
import { formatElapsed, formatShort } from "@/lib/format"

export default function Painel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((value) => value + 1), [])

  // Any incident or dispatch event invalidates every figure on this screen.
  useRealtime((event) => {
    if (event.type === "connected") return
    bump()
  })

  // An incident is only off the board once it is closed or cancelled. Counting
  // the severity over ABERTA alone made every figure read "Leves", because a
  // serious call is dispatched within seconds and leaves that bucket at once.
  const open = useResource(
    () => occurrences.list({ status: "ABERTA", per_page: 100 }),
    [refreshKey],
  )

  const dispatched = useResource(
    () => occurrences.list({ status: "DESPACHADA", per_page: 100 }),
    [refreshKey],
  )

  const inProgress = useResource(
    () => occurrences.list({ status: "EM_ATENDIMENTO", per_page: 100 }),
    [refreshKey],
  )

  // "Últimas ocorrências" means the latest ones. The list endpoint defaults to
  // the dispatcher's queue — most serious first, oldest waiting first — which
  // over a year of history puts the oldest critical calls at the top and made
  // this panel show incidents from the previous year.
  const recent = useResource(
    () => occurrences.list({ per_page: 8, sort: "recent" }),
    [refreshKey],
  )

  const fleet = useResource(() => vehicles.list({ per_page: 100 }), [refreshKey])
  const crewOnDuty = useResource(() => firefighters.list({ status: "ATIVO", per_page: 1 }), [refreshKey])
  const openDispatches = useResource(() => dispatches.list({ open: true, per_page: 100 }), [refreshKey])
  const model = useResource(() => ai.model(), [])

  const activeList = [
    ...(open.data?.items ?? []),
    ...(dispatched.data?.items ?? []),
    ...(inProgress.data?.items ?? []),
  ]

  const severe = activeList.filter((item) => item.priority === "ALTA" || item.priority === "CRITICA").length
  const medium = activeList.filter((item) => item.priority === "MEDIA").length
  const light = activeList.filter((item) => item.priority === "BAIXA").length

  const available = (fleet.data?.items ?? []).filter((vehicle) => vehicle.status === "DISPONIVEL").length
  const committed = (fleet.data?.items ?? []).filter((vehicle) => vehicle.status === "EMPENHADA").length

  return (
    <Page>
      <PageHeader
        title="Painel operacional"
        subtitle="Situação corrente do atendimento em Taubaté"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 border bg-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-neutral-700">
            <TriangleAlert className="h-7 w-7" />
            <p className="text-lg">Ocorrências em aberto</p>
          </div>

          <div className="flex items-end justify-around pt-1">
            <Figure value={severe} label="Graves" tone="text-red-600" hint="Prioridade alta ou crítica" />
            <Figure value={medium} label="Médias" tone="text-orange-600" hint="Prioridade média" />
            <Figure value={light} label="Leves" tone="text-green-600" hint="Prioridade baixa" />
          </div>

          <p className="text-sm text-neutral-500">
            Aguardando, despachadas ou em atendimento
          </p>
        </div>

        <StatBox
          icon={<Car className="h-7 w-7" />}
          label="Viaturas disponíveis"
          value={fleet.loading ? "—" : available}
          hint={`${committed} empenhada${committed === 1 ? "" : "s"} de ${fleet.data?.total ?? 0} no total`}
          tone="text-green-700"
        />

        <StatBox
          icon={<Activity className="h-7 w-7" />}
          label="Despachos em andamento"
          value={openDispatches.loading ? "—" : (openDispatches.data?.total ?? 0)}
          hint={`${inProgress.data?.total ?? 0} ocorrência(s) em atendimento`}
          tone="text-sky-700"
        />

        <StatBox
          icon={<Users className="h-7 w-7" />}
          label="Efetivo ativo"
          value={crewOnDuty.loading ? "—" : (crewOnDuty.data?.total ?? 0)}
          hint="Bombeiros com situação ATIVO"
        />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[2fr_1fr]">
        <Panel
          title="Últimas ocorrências"
          icon={<Clock className="h-5 w-5" />}
          actions={<Link to="/ocorrencias" className="font-semibold text-[#DE5656] hover:underline">Ver todas</Link>}
        >
          {recent.loading && !recent.data && <LoadingBlock />}
          {recent.error && <ErrorBox message={recent.error} onRetry={recent.reload} />}

          {recent.data && recent.data.items.length === 0 && (
            <EmptyState
              title="Nenhuma ocorrência registrada"
              description="Quando uma ocorrência for aberta ela aparece aqui em tempo real."
            />
          )}

          <div className="flex flex-col">
            {(recent.data?.items ?? []).map((occurrence) => (
              <OccurrenceRow key={occurrence.id} occurrence={occurrence} />
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Rede neural" icon={<Brain className="h-5 w-5" />}>
            {model.loading && <LoadingBlock label="Consultando o modelo..." />}

            {model.error && (
              <ErrorBox
                message={`Serviço de IA indisponível: ${model.error}`}
                onRetry={model.reload}
              />
            )}

            {model.data && (
              <dl className="flex flex-col gap-2 text-neutral-800">
                <Line term="Situação" value={
                  <Badge tone={model.data.loaded ? "bg-green-600" : "bg-[#DE5656]"}>
                    {model.data.loaded ? "Modelo carregado" : "Sem modelo"}
                  </Badge>
                } />
                <Line term="Cidade" value={model.data.city} />
                <Line term="Grafo" value={`${model.data.graph_nodes.toLocaleString("pt-BR")} nós · ${model.data.graph_edges.toLocaleString("pt-BR")} ruas`} />
                <Line term="Versão" value={<span className="font-mono text-sm">{model.data.model_version ?? "—"}</span>} />
              </dl>
            )}

            <Link to="/rede-neural" className="font-semibold text-[#DE5656] hover:underline">
              Abrir a rede neural
            </Link>
          </Panel>

          <Panel title="Tempo real" icon={<Radio className="h-5 w-5" />}>
            <LiveFeed />
          </Panel>
        </div>
      </div>
    </Page>
  )
}

function Figure({ value, label, tone, hint }: {
  value: number
  label: string
  tone: string
  /** Spells out which priorities land in this bucket, on hover. */
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center" title={hint}>
      <p className={`text-3xl font-bold sm:text-4xl ${tone}`}>{value}</p>
      <p className={`text-base font-semibold sm:text-lg ${tone}`}>{label}</p>
    </div>
  )
}

function Line({ term, value }: { term: string, value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-1.5">
      <dt className="text-neutral-600">{term}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  )
}

function OccurrenceRow({ occurrence }: { occurrence: Occurrence }) {
  return (
    <Link
      to={`/ocorrencias/${occurrence.id}`}
      className="flex items-center gap-4 border-b border-neutral-200 px-1 py-3 last:border-b-0 hover:bg-[#F5EFE6]"
    >
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center ${PRIORITY_TONE[occurrence.priority]}`}>
        <OccurrenceAvatar nature={occurrence.nature} size="sm" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-neutral-900">{NATURE_LABEL[occurrence.nature]}</p>
        <p className="truncate text-sm text-neutral-600">{occurrence.address}</p>
      </div>

      <div className="hidden flex-col items-end sm:flex">
        <Badge tone={OCCURRENCE_STATUS_TONE[occurrence.status]}>
          {OCCURRENCE_STATUS_LABEL[occurrence.status]}
        </Badge>
        <span className={`mt-1 text-sm font-semibold ${PRIORITY_TEXT_TONE[occurrence.priority]}`}>
          {PRIORITY_LABEL[occurrence.priority]}
        </span>
      </div>

      <div className="hidden w-32 flex-col items-end text-sm text-neutral-600 md:flex">
        <span>{formatShort(occurrence.opened_at)}</span>
        <span>{formatElapsed(occurrence.opened_at)}</span>
      </div>
    </Link>
  )
}

/** A rolling window of the last events, so the socket is visibly alive. */
function LiveFeed() {
  const [events, setEvents] = useState<{ id: number, text: string, at: Date }[]>([])

  const { connected } = useRealtime((event) => {
    if (event.type === "connected") return

    const text =
      event.type === "occurrence.created" ? `Nova ocorrência ${event.payload.protocol}` :
      event.type === "occurrence.updated" ? `Ocorrência ${event.payload.protocol}: ${event.payload.status}` :
      event.type === "dispatch.created" ? `Viatura ${event.payload.vehicle_prefix} despachada` :
      event.type === "dispatch.updated" ? `Despacho: ${event.payload.status}` :
      `Viatura ${event.payload.prefix} em movimento`

    setEvents((current) => [{ id: Date.now() + Math.random(), text, at: new Date() }, ...current].slice(0, 12))
  })

  if (!connected) {
    return <p className="text-neutral-600">Sem conexão com o canal de tempo real.</p>
  }

  if (events.length === 0) {
    return <p className="text-neutral-600">Conectado. Aguardando eventos do plantão.</p>
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {events.map((event) => (
        <li key={event.id} className="flex items-baseline justify-between gap-3 border-b border-neutral-100 pb-1.5 text-sm">
          <span className="text-neutral-800">{event.text}</span>
          <span className="shrink-0 text-neutral-500">
            {event.at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </li>
      ))}
    </ul>
  )
}
