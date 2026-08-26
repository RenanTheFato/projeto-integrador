/**
 * The route laboratory.
 *
 * Asks the AI for a route between two points without touching a dispatch —
 * `POST /ai/routes` without `dispatch_id` answers both variants and persists
 * nothing. It is the screen that demonstrates the model outside of a real
 * incident: pick a station, pick a destination, compare.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Brain, Compass, Route as RouteIcon } from "lucide-react"

import { ai, units } from "@/api/endpoints"
import type { RoutePreview } from "@/api/types"
import {
  ActionButton, Field, Page, PageHeader, Panel, Select, TextInput,
} from "@/components/layout/kit"
import { ErrorBox, ErrorDetails } from "@/components/layout/feedback"
import RouteMap from "@/components/mapa/route-map"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatDistance, formatDuration } from "@/lib/format"

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

  const calculate = useMutation(ai.calculateRoute)
  const [result, setResult] = useState<{ neural: RoutePreview, shortest: RoutePreview } | null>(null)

  const model = useResource(() => ai.model(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const answer = await calculate.run({
      origin_unit_id: originMode === "unit" ? unitId : undefined,
      origin_latitude: originMode === "coords" ? Number(originLatitude) : undefined,
      origin_longitude: originMode === "coords" ? Number(originLongitude) : undefined,
      destination_latitude: Number(destinationLatitude),
      destination_longitude: Number(destinationLongitude),
    })

    if (answer) setResult({ neural: answer.neural, shortest: answer.shortest })
  }

  const originReady = originMode === "unit" ? Boolean(unitId) : Boolean(originLatitude && originLongitude)

  return (
    <Page>
      <PageHeader
        title="Rotas"
        subtitle="Calcule uma rota pela rede neural e compare com o caminho mais curto em metros"
      />

      <Panel title="Calcular rota" icon={<Compass className="h-5 w-5" />}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {calculate.error && <ErrorBox message={calculate.error} />}
          <ErrorDetails details={calculate.details} />

          <div className="grid gap-4 xl:grid-cols-4">
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

            <Field label="Latitude do destino" required>
              <TextInput value={destinationLatitude} onChange={(event) => setDestinationLatitude(event.target.value)} />
            </Field>

            <Field label="Longitude do destino" required>
              <TextInput value={destinationLongitude} onChange={(event) => setDestinationLongitude(event.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              {model.data
                ? `Malha de ${model.data.city}: ${model.data.graph_nodes.toLocaleString("pt-BR")} nós e ${model.data.graph_edges.toLocaleString("pt-BR")} ruas. Pontos a mais de 2 km da malha são recusados.`
                : "O ponto precisa cair dentro da malha viária de Taubaté."}
            </p>

            <ActionButton tone="primary" type="submit" disabled={calculate.submitting || !originReady}>
              <RouteIcon className="h-5 w-5" />
              {calculate.submitting ? "Calculando..." : "Calcular rota"}
            </ActionButton>
          </div>
        </form>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Traçado" icon={<RouteIcon className="h-5 w-5" />}>
          <RouteMap
            route={result?.neural.geometry ?? null}
            comparison={result?.shortest.geometry ?? null}
            originLabel="Origem"
            destinationLabel="Destino"
            className="h-[520px] w-full"
            emptyMessage="Informe origem e destino e calcule para ver o traçado."
          />
        </Panel>

        <Panel title="Comparação" icon={<Brain className="h-5 w-5" />}>
          {!result && (
            <p className="text-neutral-600">
              As duas rotas — a que a rede neural considera mais rápida e a mais curta em metros —
              aparecem aqui lado a lado.
            </p>
          )}

          {result && (
            <>
              <VariantBlock
                title="Rede neural"
                accent="border-[#E53935]"
                preview={result.neural}
                note="Ponderada pelo tempo que o modelo estima para cada rua"
              />

              <VariantBlock
                title="Menor distância"
                accent="border-[#1565C0]"
                preview={result.shortest}
                note="Dijkstra sobre o comprimento das ruas"
              />

              <Verdict neural={result.neural} shortest={result.shortest} />
            </>
          )}
        </Panel>
      </div>
    </Page>
  )
}

function VariantBlock({ title, accent, preview, note }: {
  title: string
  accent: string
  preview: RoutePreview
  note: string
}) {
  return (
    <div className={`flex flex-col gap-1 border-l-4 bg-[#F5EFE6] px-4 py-3 ${accent}`}>
      <p className="font-bold text-neutral-900">{title}</p>
      <p className="text-3xl font-bold text-neutral-900">{formatDuration(preview.estimated_time_seconds)}</p>
      <p className="text-neutral-700">
        {formatDistance(preview.distance_meters)} · {preview.node_count} cruzamentos
      </p>
      <p className="text-sm text-neutral-500">{note}</p>
    </div>
  )
}

function Verdict({ neural, shortest }: { neural: RoutePreview, shortest: RoutePreview }) {
  const saved = shortest.estimated_time_seconds - neural.estimated_time_seconds
  const percent = shortest.estimated_time_seconds > 0
    ? (saved / shortest.estimated_time_seconds) * 100
    : 0

  const extraMeters = neural.distance_meters - shortest.distance_meters

  return (
    <div className="border bg-white px-4 py-3">
      {saved > 0 ? (
        <p className="text-neutral-900">
          A rede neural economiza <strong className="text-green-700">{formatDuration(saved)}</strong>{" "}
          ({percent.toFixed(1).replace(".", ",")}%)
          {extraMeters > 0
            ? <> aceitando {formatDistance(extraMeters)} a mais de percurso.</>
            : <> e ainda percorre menos {formatDistance(Math.abs(extraMeters))}.</>}
        </p>
      ) : saved < 0 ? (
        <p className="text-neutral-900">
          Neste par de pontos o caminho mais curto venceu por{" "}
          <strong className="text-[#DE5656]">{formatDuration(Math.abs(saved))}</strong>.
        </p>
      ) : (
        <p className="text-neutral-900">As duas rotas empatam no tempo estimado.</p>
      )}
    </div>
  )
}
