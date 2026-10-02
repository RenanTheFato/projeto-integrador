/**
 * The wallboard for the operations room (COBOM).
 *
 * Read from across the room, not operated: big figures, the open calls in
 * order of severity with how long each has been waiting, where they are, and
 * how much of the fleet is free. It refreshes itself from the live feed and,
 * as a safety net, every thirty seconds.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Maximize, Radio } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { dispatches, occurrences, units, vehicles } from "@/api/endpoints"
import {
  DISPATCH_STATUS_LABEL, NATURE_LABEL, OCCURRENCE_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_TONE,
} from "@/api/labels"
import type { Occurrence, OccurrencePriority } from "@/api/types"
import IncidentMap from "@/components/mapa/incident-map"
import type { IncidentMapMode, IncidentPoint } from "@/components/mapa/incident-map"
import { OccurrenceAvatar } from "@/components/occurrence-icon"
import { useRealtime } from "@/hooks/use-realtime"
import { useResource } from "@/hooks/use-resource"
import { toNumber } from "@/lib/format"
import { stationsOf } from "@/lib/geo"
import { cn } from "@/lib/utils"

const SEVERITY: Record<OccurrencePriority, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 }
const OPEN_STATUSES = ["ABERTA", "DESPACHADA", "EM_ATENDIMENTO"] as const

/** "12:04" since the call was opened — the number that matters on the wall. */
function waited(from: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const pad = (value: number) => String(value).padStart(2, "0")
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  return hours > 0 ? `${hours}h${pad(minutes)}` : `${pad(minutes)}:${pad(rest)}`
}

export default function Telao() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [mode, setMode] = useState<IncidentMapMode>("points")

  const open = useResource(async () => {
    const pages = await Promise.all(OPEN_STATUSES.map((status) => occurrences.list({ status, per_page: 100 })))
    return pages.flatMap((page) => page.items)
  }, [])
  const fleet = useResource(() => vehicles.list({ per_page: 100 }), [])
  const active = useResource(() => dispatches.list({ open: true, per_page: 100 }), [])
  const unitList = useResource(() => units.list({ active: true }), [])

  // The `.reload` functions are stable; the resource objects are not, and
  // depending on them would restart the 30 s interval on every clock tick.
  const reloadOpen = open.reload
  const reloadFleet = fleet.reload
  const reloadActive = active.reload
  const reload = useCallback(() => { reloadOpen(); reloadFleet(); reloadActive() }, [reloadOpen, reloadFleet, reloadActive])

  const { connected } = useRealtime(useCallback((event) => {
    if (event.type !== "connected" && event.type !== "occurrence.timeline") reload()
  }, [reload]))

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    const refresh = window.setInterval(reload, 30_000)
    return () => { window.clearInterval(clock); window.clearInterval(refresh) }
  }, [reload])

  const calls = useMemo(() => [...(open.data ?? [])].sort((a, b) =>
    SEVERITY[a.priority] - SEVERITY[b.priority]
    || new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()), [open.data])

  const byOccurrence = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const dispatch of active.data?.items ?? []) {
      map.set(dispatch.occurrence_id, [...(map.get(dispatch.occurrence_id) ?? []), `${dispatch.vehicle?.prefix ?? "?"} ${DISPATCH_STATUS_LABEL[dispatch.status].toLowerCase()}`])
    }
    return map
  }, [active.data])

  const fleetCounts = useMemo(() => {
    const items = fleet.data?.items ?? []
    return {
      free: items.filter((item) => item.status === "DISPONIVEL").length,
      busy: items.filter((item) => item.status === "EMPENHADA").length,
      down: items.filter((item) => item.status === "MANUTENCAO" || item.status === "INDISPONIVEL").length,
    }
  }, [fleet.data])

  const points: IncidentPoint[] = useMemo(() => calls.flatMap((call: Occurrence) => {
    const latitude = toNumber(call.latitude)
    const longitude = toNumber(call.longitude)
    if (latitude === null || longitude === null) return []
    return [{
      id: call.id, protocol: call.protocol, nature: call.nature, priority: call.priority, address: call.address,
      openedAt: call.opened_at, latitude, longitude,
      unitLabel: call.unit?.acronym ?? "—", unitColor: "#0B63A5",
    }]
  }), [calls])

  const stations = useMemo(() => stationsOf(unitList.data?.items), [unitList.data])
  const critical = calls.filter((call) => call.priority === "CRITICA").length
  const clock = new Date(now)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-chrome text-chrome-ink">
      <header className="flex shrink-0 items-center gap-6 border-b border-chrome-line px-6 py-3">
        <Link to="/" className="label-caps text-chrome-muted hover:text-white">ZENO · COBOM Taubaté</Link>
        <span className={cn("label-caps inline-flex items-center gap-1.5 rounded-sm border px-2 py-1", connected ? "border-accent/40" : "border-alert/60 bg-alert/30")}>
          <Radio className={cn("h-3.5 w-3.5", connected && "animate-pulse")} />
          {connected ? "Ao vivo" : "Sem conexão — dados podem estar desatualizados"}
        </span>
        <div className="ml-auto flex items-baseline gap-3">
          <span className="text-sm text-chrome-muted">{clock.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
          <time className="text-4xl font-semibold tabular-nums">{clock.toLocaleTimeString("pt-BR")}</time>
        </div>
        <button
          type="button"
          onClick={() => document.documentElement.requestFullscreen?.()}
          className="rounded-sm border border-chrome-line p-2 text-chrome-muted hover:text-white"
          aria-label="Tela cheia"
        >
          <Maximize className="h-5 w-5" />
        </button>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-px bg-chrome-line md:grid-cols-5">
        <Figure label="Ocorrências em aberto" value={calls.length} />
        <Figure label="Críticas" value={critical} tone={critical > 0 ? "text-[#F08A80]" : undefined} />
        <Figure label="Viaturas livres" value={fleetCounts.free} tone="text-[#8FD0B0]" />
        <Figure label="Viaturas empenhadas" value={fleetCounts.busy} tone="text-[#9CC7EA]" />
        <Figure label="Fora de operação" value={fleetCounts.down} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ol className="min-h-0 overflow-y-auto border-r border-chrome-line">
          {calls.length === 0 && <li className="px-6 py-10 text-xl text-chrome-muted">Nenhuma ocorrência em aberto.</li>}
          {calls.map((call) => (
            <li key={call.id}>
              <button
                type="button"
                onClick={() => navigate(`/ocorrencias/${call.id}`)}
                className="flex w-full items-stretch border-b border-chrome-line text-left hover:bg-chrome-soft"
              >
                <span aria-hidden className={cn("w-2 shrink-0", PRIORITY_TONE[call.priority])} />
                <span className="flex flex-1 items-center gap-4 px-4 py-3">
                  <OccurrenceAvatar nature={call.nature} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-semibold">{NATURE_LABEL[call.nature]}</span>
                    <span className="truncate text-chrome-muted">{call.address}</span>
                    <span className="text-sm text-chrome-muted">
                      {call.protocol} · {PRIORITY_LABEL[call.priority]} · {OCCURRENCE_STATUS_LABEL[call.status]}
                      {byOccurrence.get(call.id)?.length ? ` · ${byOccurrence.get(call.id)!.join(", ")}` : call.status === "ABERTA" ? " · aguardando viatura" : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-3xl font-semibold tabular-nums", call.status === "ABERTA" && call.priority !== "BAIXA" ? "text-[#F2C46D]" : "text-chrome-ink")}>
                    {waited(call.opened_at, now)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="hidden min-h-0 lg:block">
          <IncidentMap
            incidents={points}
            stations={stations}
            mode={mode}
            onModeChange={setMode}
            onOpen={(id) => navigate(`/ocorrencias/${id}`)}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  )
}

function Figure({ label, value, tone }: { label: string, value: number, tone?: string }) {
  return (
    <div className="flex flex-col bg-chrome px-6 py-3">
      <span className="label-caps text-chrome-muted">{label}</span>
      <span className={cn("text-5xl font-semibold tabular-nums", tone)}>{value}</span>
    </div>
  )
}
