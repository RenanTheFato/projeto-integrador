/**
 * Coverage: where the stations reach in time, and where they do not.
 *
 * The planning question a commander asks — "how much of our demand do we
 * reach in eight minutes, and what if we opened a post over there" — answered
 * with the same predicted travel times the dispatcher's routes use. The demand
 * is the most recent occurrences, each priced by the network from the nearest
 * station, not counted by drawing a polygon.
 */

import { useMemo, useState } from "react"
import { Crosshair, MapPinned, Plus, Target, X } from "lucide-react"

import { ai, waterSources } from "@/api/endpoints"
import { PRIORITY_LABEL } from "@/api/labels"
import type { Coverage, OccurrencePriority } from "@/api/types"
import { ActionButton, Field, Page, PageHeader, Panel, Select, StatBox } from "@/components/layout/kit"
import { ErrorBox, LoadingBlock } from "@/components/layout/feedback"
import CoverageMap, { POINT_COLOR, pointClass } from "@/components/mapa/coverage-map"
import { useResource } from "@/hooks/use-resource"
import { cn } from "@/lib/utils"

const BANDS = [4, 8, 12]
const PRIORITIES: OccurrencePriority[] = ["CRITICA", "ALTA", "MEDIA", "BAIXA"]

interface Hypothetical {
  latitude: number
  longitude: number
}

function share(coverage: Coverage | null, minutes: number): number | null {
  if (!coverage?.demand || coverage.demand.sample_size === 0) return null
  return (coverage.demand.covered[String(minutes)] ?? 0) / coverage.demand.sample_size
}

const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1).replace(".", ",")}%`

export default function Cobertura() {
  const [target, setTarget] = useState(8)
  const [criticalMode, setCriticalMode] = useState(false)
  const [sampleSize, setSampleSize] = useState("3000")
  const [placing, setPlacing] = useState(false)
  const [extras, setExtras] = useState<Hypothetical[]>([])
  const [showWater, setShowWater] = useState(false)

  const minutes = useMemo(() => [...new Set([...BANDS, target])].sort((a, b) => a - b), [target])

  const baseline = useResource(
    () => ai.coverage({ minutes, critical_mode: criticalMode, sample_size: Number(sampleSize) }),
    [minutes.join(","), criticalMode, sampleSize],
  )

  const extrasKey = extras.map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`).join(";")
  const scenario = useResource(
    () => ai.coverage({
      minutes,
      critical_mode: criticalMode,
      sample_size: Number(sampleSize),
      extra_stations: extras.map((point, index) => ({ ...point, label: `NOVO-${index + 1}` })),
    }),
    [minutes.join(","), criticalMode, sampleSize, extrasKey],
    { enabled: extras.length > 0 },
  )

  const water = useResource(() => waterSources.list(), [], { enabled: showWater })

  // While a scenario is being priced the baseline stays on screen, so the map
  // never goes blank between clicks.
  const shown = extras.length > 0 ? scenario.data ?? baseline.data : baseline.data
  const loading = extras.length > 0 ? scenario.loading : baseline.loading
  const error = extras.length > 0 ? scenario.error : baseline.error

  const baseShare = share(baseline.data, target)
  const scenarioShare = extras.length > 0 ? share(scenario.data, target) : null

  const maxMinutes = Math.max(...minutes)

  const byPriority = useMemo(() => {
    const points = shown?.demand?.points ?? []
    return PRIORITIES.map((priority) => {
      const subset = points.filter((point) => point.priority === priority)
      const covered = subset.filter((point) => pointClass(point, target, maxMinutes) === "covered").length
      return { priority, total: subset.length, share: subset.length > 0 ? covered / subset.length : null }
    })
  }, [shown, target, maxMinutes])

  function handlePick(latitude: number, longitude: number) {
    setExtras((current) => [...current, { latitude, longitude }].slice(-3))
    setPlacing(false)
  }

  const targetArea = shown?.isochrones.find((area) => area.minutes === target)

  return (
    <Page>
      <PageHeader
        title="Cobertura"
        subtitle="Até onde cada quartel chega no tempo-resposta, medido contra as ocorrências recentes."
        actions={(
          <ActionButton
            tone={placing ? "primary" : "neutral"}
            onClick={() => setPlacing((value) => !value)}
            disabled={extras.length >= 3 && !placing}
            aria-pressed={placing}
          >
            {placing ? <Crosshair className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {placing ? "Clique no mapa para posicionar" : "Simular novo posto"}
          </ActionButton>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox
          icon={<Target className="h-4 w-4" />}
          label={`Demanda alcançada em ${target} min`}
          value={percent(extras.length > 0 ? scenarioShare : baseShare)}
          hint={shown?.demand ? `${(shown.demand.covered[String(target)] ?? 0).toLocaleString("pt-BR")} de ${shown.demand.sample_size.toLocaleString("pt-BR")} ocorrências recentes` : undefined}
          tone="text-accent"
        />
        <StatBox
          label={`Área coberta em ${target} min`}
          value={targetArea ? `${targetArea.area_km2.toLocaleString("pt-BR")} km²` : "—"}
          hint={`${shown?.stations.filter((station) => station.in_network && !station.hypothetical).length ?? 0} quartéis na malha`}
        />
        <StatBox
          label="Ganho do cenário"
          value={extras.length === 0 || scenarioShare === null || baseShare === null
            ? "—"
            : `${scenarioShare >= baseShare ? "+" : ""}${((scenarioShare - baseShare) * 100).toFixed(1).replace(".", ",")} p.p.`}
          hint={extras.length === 0 ? "Posicione um posto hipotético para comparar" : `${extras.length} posto(s) hipotético(s)`}
          tone={extras.length > 0 && scenarioShare !== null && baseShare !== null && scenarioShare > baseShare ? "text-ok" : "text-ink"}
        />
        <StatBox
          label="Críticas alcançadas"
          value={percent(byPriority[0].share)}
          hint={`${byPriority[0].total.toLocaleString("pt-BR")} ocorrências críticas na amostra`}
          tone="text-alert"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(300px,1fr)]">
        <Panel title="Mapa de cobertura" icon={<MapPinned className="h-5 w-5" />}>
          {error && <ErrorBox message={error} onRetry={extras.length > 0 ? scenario.reload : baseline.reload} />}
          {loading && !shown && <LoadingBlock label="Calculando as áreas pela rede neural..." />}
          <div className="relative">
            <CoverageMap
              areas={shown?.isochrones ?? []}
              stations={shown?.stations ?? []}
              points={shown?.demand?.points ?? []}
              targetMinutes={target}
              waterSources={showWater ? water.data ?? [] : []}
              onPick={placing ? handlePick : undefined}
              className="h-[62vh] min-h-[360px] w-full"
            />
            {loading && shown && (
              <span className="label-caps absolute left-3 top-3 rounded-sm border border-line bg-surface px-2 py-1 text-ink-muted shadow">
                Recalculando...
              </span>
            )}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POINT_COLOR.covered }} />Alcançada em {target} min</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POINT_COLOR.late }} />Alcançada até {maxMinutes} min</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POINT_COLOR.outside }} />Além de {maxMinutes} min</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POINT_COLOR.unknown }} />Fora da malha</li>
            <li>Faixas azuis: {minutes.join(", ")} min (mais escura = mais rápida)</li>
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Parâmetros">
            <Field label="Tempo-resposta alvo" hint="Deslocamento, sem contar saída do quartel. A NFPA 1710 usa 4 min para a primeira viatura.">
              <Select
                value={String(target)}
                onChange={(value) => setTarget(Number(value))}
                options={[4, 6, 8, 10, 12, 15].map((value) => ({ value: String(value), label: `${value} minutos` }))}
              />
            </Field>
            <Field label="Amostra de demanda">
              <Select
                value={sampleSize}
                onChange={setSampleSize}
                options={[
                  { value: "1000", label: "Últimas 1.000 ocorrências" },
                  { value: "3000", label: "Últimas 3.000 ocorrências" },
                  { value: "10000", label: "Últimas 10.000 ocorrências" },
                ]}
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={criticalMode} onChange={(event) => setCriticalMode(event.target.checked)} className="mt-0.5 h-4 w-4" />
              <span><strong className="text-ink">Modo crítico</strong><span className="block text-ink-muted">Áreas com o perfil de deslocamento de emergência.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={showWater} onChange={(event) => setShowWater(event.target.checked)} className="mt-0.5 h-4 w-4" />
              <span><strong className="text-ink">Mostrar pontos de água</strong><span className="block text-ink-muted">Hidrantes e cisternas cadastrados.</span></span>
            </label>
          </Panel>

          <Panel title="Por prioridade">
            <ul className="flex flex-col gap-2">
              {byPriority.map((row) => (
                <li key={row.priority} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">{PRIORITY_LABEL[row.priority]}</span>
                    <span className="font-semibold tabular-nums text-ink">{percent(row.share)}</span>
                  </div>
                  <div className="h-2 w-full rounded-sm bg-mute-soft">
                    <div className="h-2 rounded-sm bg-accent" style={{ width: `${(row.share ?? 0) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Quartéis">
            <ul className="flex flex-col divide-y divide-line text-sm">
              {(shown?.stations ?? []).map((station) => (
                <li key={station.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className={cn("font-semibold", station.hypothetical ? "text-warn" : "text-ink")}>
                    {station.acronym}
                    <span className="ml-2 font-normal text-ink-muted">{station.hypothetical ? "hipotético" : station.name}</span>
                  </span>
                  {station.hypothetical ? (
                    <button
                      type="button"
                      aria-label={`Remover ${station.acronym}`}
                      onClick={() => setExtras((current) => current.filter((_, index) => `NOVO-${index + 1}` !== station.acronym))}
                      className="text-ink-muted hover:text-alert"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : !station.in_network && <span className="text-xs text-ink-soft">fora da malha</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-soft">
              Tempos previstos pela rede neural{shown?.model_version ? ` (modelo ${shown.model_version})` : ""}. Até 3 postos hipotéticos por cenário.
            </p>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
