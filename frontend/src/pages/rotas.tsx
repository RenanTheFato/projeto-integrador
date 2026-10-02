/**
 * The route laboratory.
 *
 * Asks the AI for a route between two points without touching a dispatch —
 * `POST /ai/routes` without `dispatch_id` answers both variants and persists
 * nothing. It is the screen that demonstrates the model outside of a real
 * incident: pick a station, pick a destination, compare.
 */

import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Brain, Compass, MapPin, Play, Route as RouteIcon } from "lucide-react"

import { ai, units } from "@/api/endpoints"
import type { RoutePreview } from "@/api/types"
import {
  ActionButton, Field, Page, PageHeader, Panel, Select, TextInput,
} from "@/components/layout/kit"
import { ErrorBox, ErrorDetails } from "@/components/layout/feedback"
import RouteMap from "@/components/mapa/route-map"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatCoordinate, formatDistance, formatDuration } from "@/lib/format"
import { nearestTo, stationsOf } from "@/lib/geo"

/** Taubaté's centre — a sane starting point for the destination fields. */
const DEFAULT_DESTINATION = { latitude: "-23.0330", longitude: "-45.5620" }

export default function Rotas() {
  const unitList = useResource(() => units.list({ active: true }), [])

  const [originMode, setOriginMode] = useState<"unit" | "coords">("unit")
  const [unitId, setUnitId] = useState("")
  const [originLatitude, setOriginLatitude] = useState("-23.0264")
  const [originLongitude, setOriginLongitude] = useState("-45.5551")
  const [destinationLatitude, setDestinationLatitude] = useState(DEFAULT_DESTINATION.latitude)
  const [destinationLongitude, setDestinationLongitude] = useState(DEFAULT_DESTINATION.longitude)
  const [criticalMode, setCriticalMode] = useState(false)

  const calculate = useMutation(ai.calculateRoute)
  const [result, setResult] = useState<{
    neural: RoutePreview
    critical: RoutePreview | null
    shortest: RoutePreview
    criticalMode: boolean
    originLabel: string
  } | null>(null)
  const [comparisonSimulationRequest, setComparisonSimulationRequest] = useState(0)

  // Theater gives the map the page's whole width, laid out the way the
  // statistics map already is, and pushes the comparison underneath instead of
  // beside it. The map keeps its element and therefore its camera and its 3D
  // state; only the box around it changes shape.
  const [theater, setTheater] = useState(false)

  const model = useResource(() => ai.model(), [])
  const coverage = model.data?.bounds ?? null

  const destination = {
    latitude: Number(destinationLatitude),
    longitude: Number(destinationLongitude),
  }

  const destinationValid =
    Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude)
    && destinationLatitude.trim() !== "" && destinationLongitude.trim() !== ""

  // Warned before the request, not after it comes back rejected. The rectangle
  // is the extent of the street graph; the AI still refuses a point inside it
  // that is more than `max_snap_distance_m` from an actual mapped street, so
  // this catches the obvious mistake and the service catches the subtle one.
  const outsideCoverage = Boolean(
    coverage && destinationValid && (
      destination.latitude < coverage.min_latitude
      || destination.latitude > coverage.max_latitude
      || destination.longitude < coverage.min_longitude
      || destination.longitude > coverage.max_longitude
    ),
  )

  /**
   * Every station that can be plotted, ready for the map.
   *
   * They are drawn from the moment the screen opens, before any destination
   * exists, which is the whole point: the dispatcher can see the layout of the
   * city's stations and judge which one is worth departing from.
   */
  const stations = useMemo(() => stationsOf(unitList.data?.items), [unitList.data])

  const nearest = useMemo(
    () => (destinationValid ? nearestTo(destination, stations) : null),
    // The destination object is rebuilt every render; its two numbers are what
    // actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinationValid, destination.latitude, destination.longitude, stations],
  )

  const nearestIsOrigin = originMode === "unit" && nearest?.item.id === unitId

  function handlePick(latitude: number, longitude: number) {
    setDestinationLatitude(latitude.toFixed(6))
    setDestinationLongitude(longitude.toFixed(6))
  }

  function handleStationSelect(id: string) {
    setOriginMode("unit")
    setUnitId(id)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const answer = await calculate.run({
      origin_unit_id: originMode === "unit" ? unitId : undefined,
      origin_latitude: originMode === "coords" ? Number(originLatitude) : undefined,
      origin_longitude: originMode === "coords" ? Number(originLongitude) : undefined,
      destination_latitude: Number(destinationLatitude),
      destination_longitude: Number(destinationLongitude),
      critical_mode: criticalMode,
    })

    if (answer) {
      setResult({
        neural: answer.neural,
        critical: answer.critical,
        shortest: answer.shortest,
        criticalMode: answer.critical_mode,
        originLabel: originMode === "unit" ? stations.find((station) => station.id === unitId)?.acronym ?? "Origem" : "Origem",
      })
    }
  }

  const originReady = originMode === "unit" ? Boolean(unitId) : Boolean(originLatitude && originLongitude)

  return (
    <Page>
      <PageHeader
        title="Rotas"
        subtitle="Planeje o deslocamento, compare os percursos e acompanhe a simulação das viaturas."
      />

      <Panel title="Planejar deslocamento" icon={<Compass className="h-5 w-5" />}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {calculate.error && <ErrorBox message={calculate.error} />}
          <ErrorDetails details={calculate.details} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Origem">
              <Select
                value={originMode}
                onChange={(value) => setOriginMode(value as "unit" | "coords")}
                options={[
                  { value: "unit", label: "Partir de uma unidade" },
                  { value: "coords", label: "Coordenadas manuais" },
                ]}
              />
            </Field>

            {originMode === "unit" ? (
              <Field label="Unidade" required>
                <Select
                  value={unitId}
                  onChange={setUnitId}
                  placeholder={unitList.loading ? "Carregando..." : "Selecione o quartel"}
                  options={(unitList.data?.items ?? []).map((unit) => ({
                    value: unit.id,
                    label: `${unit.acronym} — ${unit.name}`,
                  }))}
                />
              </Field>
            ) : (
              <>
                <Field label="Latitude de origem" required>
                  <TextInput value={originLatitude} onChange={(event) => setOriginLatitude(event.target.value)} />
                </Field>
                <Field label="Longitude de origem" required>
                  <TextInput value={originLongitude} onChange={(event) => setOriginLongitude(event.target.value)} />
                </Field>
              </>
            )}

            <Field label="Latitude do destino" required hint="Ou clique direto no mapa">
              <TextInput value={destinationLatitude} onChange={(event) => setDestinationLatitude(event.target.value)} />
            </Field>

            <Field label="Longitude do destino" required hint="Use ponto decimal, não vírgula">
              <TextInput value={destinationLongitude} onChange={(event) => setDestinationLongitude(event.target.value)} />
            </Field>
          </div>

          <div className="route-critical-option" data-active={criticalMode}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={criticalMode}
              onChange={(event) => setCriticalMode(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="flex flex-col gap-1">
              <strong className="text-sm text-ink">Incluir modo crítico</strong>
              <span className="text-sm text-ink-muted">
                Compare também a alternativa com exceções operacionais.
              </span>
            </span>
          </label>
          <details className="route-detail-note"><summary>Critérios do modo crítico</summary><p>Considera contrafluxo e vantagens de acostamento quando a malha indicar viabilidade física, sem atravessar barreiras, túneis, pontes, rotatórias ou acessos explicitamente restritos.</p></details>
          </div>

          {nearest && !outsideCoverage && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-accent/30 bg-accent-soft px-4 py-2 text-ink">
              <MapPin className="h-4 w-4 shrink-0 text-accent" />
              <span>
                Quartel mais próximo do destino: <strong>{nearest.item.acronym}</strong> —{" "}
                {nearest.item.name}, a {formatDistance(nearest.meters)} em linha reta.
              </span>
              {nearestIsOrigin
                ? <span className="text-sm font-semibold text-accent">Já é a origem selecionada.</span>
                : (
                  <button
                    type="button"
                    onClick={() => handleStationSelect(nearest.item.id)}
                    className="text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-strong"
                  >
                    Usar como origem
                  </button>
                )}
            </p>
          )}

          {outsideCoverage && coverage && (
            <p className="rounded-sm border border-warn/30 bg-warn-soft px-4 py-2 text-ink">
              Esse destino está fora do retângulo tracejado no mapa, que é toda a malha viária
              que o modelo conhece. A malha vai de {formatCoordinate(coverage.min_latitude)} a{" "}
              {formatCoordinate(coverage.max_latitude)} de latitude e de{" "}
              {formatCoordinate(coverage.min_longitude)} a {formatCoordinate(coverage.max_longitude)} de
              longitude.
            </p>
          )}

          <div className="route-submit-row">
            <details className="route-detail-note"><summary>{model.data ? `Área de cálculo · ${model.data.city}` : "Sobre a área de cálculo"}</summary><p>
              {model.data
                ? `Malha de ${model.data.city}: ${model.data.graph_nodes.toLocaleString("pt-BR")} nós e ${model.data.graph_edges.toLocaleString("pt-BR")} ruas. Pontos a mais de ${((coverage?.max_snap_distance_m ?? 2000) / 1000).toLocaleString("pt-BR")} km de uma rua mapeada são recusados — o norte rural do município quase não tem ruas no OpenStreetMap.`
                : "O ponto precisa cair dentro da malha viária de Taubaté."}
            </p></details>

            <ActionButton tone="primary" type="submit" disabled={calculate.submitting || !originReady}>
              <RouteIcon className="h-5 w-5" />
              {calculate.submitting ? "Calculando..." : "Calcular rota"}
            </ActionButton>
          </div>
        </form>
      </Panel>

      <div className={theater ? "flex flex-col gap-5" : "grid items-start gap-5 xl:grid-cols-[minmax(0,2.1fr)_minmax(310px,1fr)]"}>
        <Panel
          title="Mapa de deslocamento"
          icon={<RouteIcon className="h-5 w-5" />}
          actions={result ? (
            <ActionButton
              tone="neutral"
              className="px-3 py-1.5 text-sm"
              onClick={() => setComparisonSimulationRequest((value) => value + 1)}
            >
              <Play className="h-4 w-4" />
              Comparar viaturas
            </ActionButton>
          ) : undefined}
        >
          {result && (
            <div className="route-legend">
              <span className="flex items-center gap-2">
                <span className="h-[3px] w-5 bg-[#0B63A5]" />
                IA
              </span>
              {result.critical && (
                <span className="flex items-center gap-2">
                  <span className="h-[3px] w-5 bg-[#C9362B]" />
                  Modo crítico
                </span>
              )}
              <span className="flex items-center gap-2">
                <span className="h-[3px] w-5 bg-[#D97706]" />
                Padrão
              </span>
              <small>{result.critical ? 3 : 2} percursos calculados</small>
            </div>
          )}

          <RouteMap
            route={result?.neural.geometry ?? null}
            critical={result?.critical?.geometry ?? null}
            comparison={result?.shortest.geometry ?? null}
            coverage={coverage}
            onPick={handlePick}
            pin={!result && destinationValid ? destination : null}
            stations={stations}
            selectedStationId={originMode === "unit" ? unitId : null}
            nearestStationId={nearest?.item.id ?? null}
            onStationSelect={handleStationSelect}
            originLabel={result?.originLabel ?? "Origem"}
            destinationLabel="Destino"
            theater={theater}
            onTheaterToggle={() => setTheater((current) => !current)}
            comparisonSimulationRequest={comparisonSimulationRequest}
            comparisonSimulationTimes={result ? {
              primarySeconds: result.neural.estimated_time_seconds,
              comparisonSeconds: result.shortest.estimated_time_seconds,
              criticalSeconds: result.critical?.estimated_time_seconds,
            } : undefined}
            className={theater
              ? "h-[78vh] min-h-[420px] w-full"
              : "h-[60vh] max-h-[640px] min-h-[340px] w-full"}
            emptyMessage="Informe origem e destino e calcule para ver o traçado."
          />
        </Panel>

        <Panel title="Análise dos percursos" icon={<Brain className="h-5 w-5" />}>
          {!result && (
            <div className="route-empty-analysis"><span>ANTES DE COMPARAR</span><h3>Defina o percurso no mapa</h3><ol><li><strong>Origem</strong><p>Escolha o quartel de partida ou informe as coordenadas.</p></li><li><strong>Destino</strong><p>Marque o ponto no mapa e calcule a rota.</p></li><li><strong>Comparação</strong><p>Consulte tempo e distância e acompanhe as viaturas em 3D.</p></li></ol></div>
          )}

          {result && (
            <>
              <RoutePerformance neural={result.neural} critical={result.critical} shortest={result.shortest} />

              {result.critical && <CriticalSummary preview={result.critical} />}


            </>
          )}
        </Panel>
      </div>
    </Page>
  )
}

function RoutePerformance({ neural, critical, shortest }: {
  neural: RoutePreview
  critical: RoutePreview | null
  shortest: RoutePreview
}) {
  const [metric, setMetric] = useState<"time" | "distance">("time")
  const variants = [
    { label: "IA", color: "#0B63A5", route: neural },
    ...(critical ? [{ label: "Modo crítico", color: "#B8322A", route: critical }] : []),
    { label: "Padrão", color: "#B86A12", route: shortest },
  ]
  const valueOf = (route: RoutePreview) => metric === "time" ? route.estimated_time_seconds : route.distance_meters
  const max = Math.max(...variants.map((entry) => valueOf(entry.route)), 1)
  const formatted = (route: RoutePreview) => metric === "time" ? formatDuration(valueOf(route)) : formatDistance(valueOf(route))
  return (
    <figure className="route-performance">
      <figcaption>
        <span>MESMA ORIGEM · MESMO DESTINO</span>
        <p>Compare o custo de cada percurso</p>
      </figcaption>
      <div className="route-metric-tabs" aria-label="Métrica da comparação">
        <button type="button" aria-pressed={metric === "time"} onClick={() => setMetric("time")}>Tempo estimado</button>
        <button type="button" aria-pressed={metric === "distance"} onClick={() => setMetric("distance")}>Distância</button>
      </div>
      <div className="route-performance-axis"><span>0</span><span>{metric === "time" ? formatDuration(max) : formatDistance(max)}</span></div>
      {variants.map((entry) => (
        <div className="route-performance-row" key={entry.label}>
          <div><strong>{entry.label}</strong><span>{formatted(entry.route)}</span></div>
          <div className="route-performance-track" role="img" aria-label={`${entry.label}: ${formatted(entry.route)}`}>
            <div style={{ width: `${valueOf(entry.route) / max * 100}%`, backgroundColor: entry.color }} />
          </div>
          <p>{metric === "time" ? formatDistance(entry.route.distance_meters) : formatDuration(entry.route.estimated_time_seconds)} · {entry.route.node_count} cruzamentos</p>
        </div>
      ))}
      <p className="route-performance-note">Escala comum, a partir de zero. Tempos estimados pelo modelo; a reprodução preserva a proporção entre as chegadas.</p>
    </figure>
  )
}

function CriticalSummary({ preview }: { preview: RoutePreview }) {
  const maneuvers = preview.critical_maneuvers
  const counterflow = maneuvers?.counterflow_segments ?? 0
  const shoulder = maneuvers?.shoulder_segments ?? 0

  return (
    <div className="rounded-sm border border-alert/25 bg-alert-soft px-4 py-3 text-sm text-ink">
      <p className="font-semibold">Exceções operacionais consideradas</p>
      <p className="mt-1 text-ink-muted">
        {counterflow} trecho(s) de contrafluxo elegível · {shoulder} trecho(s) com
        benefício de acostamento mapeado. A simulação usa atributos do OpenStreetMap;
        a viabilidade real continua dependendo das condições da via e da decisão operacional.
      </p>
    </div>
  )
}
