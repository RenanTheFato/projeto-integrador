/**
 * The incident map.
 *
 * Where the route map draws one journey, this one draws the whole record — and
 * it draws it four ways, because "where do the calls come from" is really four
 * questions:
 *
 *  - **Calor** — where the calls concentrate, as a density surface. Answers
 *    "which part of the city keeps us busy".
 *  - **Pontos** — every call as its own dot, coloured by priority and clickable
 *    through to the record. Answers "which call was that".
 *  - **Cobertura** — every call in the colour of the post that answered it,
 *    which draws each post's real territory rather than the one on paper.
 *  - **Recorrências** — only the addresses that came back, sized by how often.
 *    Answers "what do we keep going back to".
 *
 * They are modes rather than layers stacked together, because a heat wash under
 * three hundred dots reads as neither. Stations ride along on all four: the
 * useful version of "the north-east calls the most" is "the north-east calls
 * the most and the nearest post is across the river".
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Layers, MapPin, Maximize, Minimize, Repeat } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import type { GraphBounds, OccurrencePriority } from "@/api/types"
import { NATURE_LABEL, PRIORITY_LABEL } from "@/api/labels"
import { STYLE } from "./constants/constants"
import { fitBoundsOf } from "./map/helpers"
import { addCoverageLayer, updateCoverageData } from "./map/layers"
import { createStationMarker } from "./map/markers"
import type { MapStation } from "./route-map"
import { cn } from "@/lib/utils"

import "./mapa.css"

/** Taubaté's centre, for the moment before the coverage rectangle arrives. */
const FALLBACK_CENTER: [number, number] = [-45.5551, -23.0264]

const POINT_SOURCE = "src-incidents"
const CLUSTER_SOURCE = "src-recurrences"
const HEAT_LAYER = "incidents-heat"
const POINT_LAYER = "incidents-point"
const UNIT_LAYER = "incidents-unit"
const CLUSTER_LAYER = "recurrences-circle"
const CLUSTER_LABEL = "recurrences-label"

/**
 * The four priorities are an ordered severity scale, so they wear the status
 * palette — good, warning, serious, critical — never a categorical one. The
 * legend names every step, so colour is never the only thing carrying it.
 */
export const PRIORITY_COLOR: Record<OccurrencePriority, string> = {
  BAIXA: "#16A34A",
  MEDIA: "#E8A240",
  ALTA: "#DE5656",
  CRITICA: "#991B1B",
}

/**
 * Identity colours for the responding posts.
 *
 * Validated against a white surface: worst adjacent pair ΔE 19.2 under
 * deuteranopia and 29.2 for normal vision, every slot over the contrast floor.
 * Assigned in fixed order so a post keeps its colour when a filter removes
 * another one — a reader who learned "Quiririm is green" is not re-taught.
 */
export const UNIT_COLORS = ["#1565C0", "#B06A12", "#7B3FA0", "#2E7D32", "#0F766E", "#9F1239"]

export interface IncidentPoint {
  id: string
  protocol: string
  nature: keyof typeof NATURE_LABEL
  priority: OccurrencePriority
  address: string
  openedAt: string
  latitude: number
  longitude: number
  /** Which post answered, and the colour it was given. */
  unitLabel: string
  unitColor: string
}

export interface RecurrenceCluster {
  id: string
  label: string
  latitude: number
  longitude: number
  count: number
}

export type IncidentMapMode = "heat" | "points" | "coverage" | "recurrence"

export interface IncidentMapProps {
  incidents: IncidentPoint[]
  clusters?: RecurrenceCluster[]
  stations?: MapStation[]
  coverage?: GraphBounds | null
  mode: IncidentMapMode
  onModeChange: (mode: IncidentMapMode) => void
  /** Opening an incident from its popup. */
  onOpen?: (id: string) => void
  className?: string
}

type View = "inline" | "full"

function featuresOf(incidents: IncidentPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents.map((incident) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [incident.longitude, incident.latitude] },
      properties: {
        id: incident.id,
        protocol: incident.protocol,
        nature: incident.nature,
        priority: incident.priority,
        address: incident.address,
        openedAt: incident.openedAt,
        unitLabel: incident.unitLabel,
        unitColor: incident.unitColor,
      },
    })),
  }
}

function clusterFeatures(clusters: RecurrenceCluster[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: clusters.map((cluster) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [cluster.longitude, cluster.latitude] },
      properties: { id: cluster.id, label: cluster.label, count: cluster.count },
    })),
  }
}

const MODES: { value: IncidentMapMode, label: string, Icon: React.ElementType, title: string }[] = [
  { value: "heat", label: "Calor", Icon: Flame, title: "Concentração de ocorrências" },
  { value: "points", label: "Pontos", Icon: MapPin, title: "Cada ocorrência como um ponto, clicável" },
  { value: "coverage", label: "Cobertura", Icon: Layers, title: "Cada ocorrência na cor do quartel que atendeu" },
  { value: "recurrence", label: "Recorrências", Icon: Repeat, title: "Endereços que voltaram mais de uma vez" },
]

export default function IncidentMap({
  incidents, clusters, stations, coverage, mode, onModeChange, onOpen, className,
}: IncidentMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const stationMarkers = useRef(new Map<string, maplibregl.Marker>())

  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>("inline")

  const data = useMemo(() => featuresOf(incidents), [incidents])
  const clusterData = useMemo(() => clusterFeatures(clusters ?? []), [clusters])

  const dataRef = useRef(data)
  dataRef.current = data
  const clusterRef = useRef(clusterData)
  clusterRef.current = clusterData
  const coverageRef = useRef(coverage)
  coverageRef.current = coverage
  const openRef = useRef(onOpen)
  openRef.current = onOpen

  // -- lifecycle -------------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: FALLBACK_CENTER,
      zoom: 11.5,
      pitch: 0,
      bearing: 0,
    })

    mapRef.current = map

    // Captured now: the cleanup must clear the collection this map filled, not
    // whatever the ref happens to hold at teardown.
    const markers = stationMarkers.current

    map.on("load", () => {
      addCoverageLayer(map, coverageRef.current)

      map.addSource(POINT_SOURCE, { type: "geojson", data: dataRef.current })
      map.addSource(CLUSTER_SOURCE, { type: "geojson", data: clusterRef.current })

      map.addLayer({
        id: HEAT_LAYER,
        type: "heatmap",
        source: POINT_SOURCE,
        paint: {
          // Every incident counts the same. Weighting by priority would answer
          // "where are the bad ones", which is a different question and one the
          // point view already answers by colour.
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 16, 42],
          "heatmap-opacity": 0.75,
          // One hue, light to dark: density is a magnitude, not an identity.
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(255,255,255,0)",
            0.2, "#FEE2E2",
            0.45, "#FCA5A5",
            0.7, "#EF4444",
            1, "#991B1B",
          ],
        },
      })

      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: POINT_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 9],
          "circle-color": [
            "match", ["get", "priority"],
            "BAIXA", PRIORITY_COLOR.BAIXA,
            "MEDIA", PRIORITY_COLOR.MEDIA,
            "ALTA", PRIORITY_COLOR.ALTA,
            "CRITICA", PRIORITY_COLOR.CRITICA,
            "#525252",
          ],
          // The 2px surface ring keeps overlapping incidents legible.
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 0.92,
        },
      })

      map.addLayer({
        id: UNIT_LAYER,
        type: "circle",
        source: POINT_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 9],
          // The colour travels inside the feature rather than in a `match`
          // built from the current unit list, so a filter that drops one post
          // cannot shuffle the colours of the ones that remain.
          "circle-color": ["get", "unitColor"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 0.9,
        },
      })

      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: CLUSTER_SOURCE,
        layout: { visibility: "none" },
        paint: {
          // The square root of the count drives the radius, so it is the
          // circle's *area* that tracks the number. Mapping the count straight
          // onto the radius would show four times the ink for twice the calls.
          "circle-radius": [
            "interpolate", ["linear"], ["sqrt", ["get", "count"]],
            1, 9,
            5, 32,
          ],
          "circle-color": "#DE5656",
          "circle-opacity": 0.55,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
        },
      })

      map.addLayer({
        id: CLUSTER_LABEL,
        type: "symbol",
        source: CLUSTER_SOURCE,
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", "count"]],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#FFFFFF",
          "text-halo-color": "#991B1B",
          "text-halo-width": 1.2,
        },
      })

      if (coverageRef.current) fitBoundsOf(map, coverageRef.current)

      setReady(true)
    })

    const openPopup = (
      event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
      kind: "incident" | "cluster",
    ) => {
      const feature = event.features?.[0]
      if (!feature) return

      const properties = feature.properties as Record<string, string>

      popupRef.current?.remove()

      // Built as DOM rather than an HTML string: the protocol and the address
      // are user input and must never be parsed as markup.
      const node = document.createElement("div")
      node.style.cssText = "font:13px/1.45 system-ui,sans-serif;color:#171717;min-width:190px"

      if (kind === "cluster") {
        const count = document.createElement("p")
        count.style.cssText = "font-weight:700;margin:0 0 2px"
        count.textContent = `${properties.count} ocorrências neste endereço`

        const label = document.createElement("p")
        label.style.cssText = "margin:0;color:#525252"
        label.textContent = properties.label

        node.append(count, label)
      } else {
        const protocol = document.createElement("p")
        protocol.style.cssText = "font-weight:700;margin:0 0 2px"
        protocol.textContent = properties.protocol

        const nature = document.createElement("p")
        nature.style.cssText = "margin:0"
        nature.textContent = NATURE_LABEL[properties.nature as keyof typeof NATURE_LABEL]
          ?? properties.nature

        const address = document.createElement("p")
        address.style.cssText = "margin:0;color:#525252"
        address.textContent = properties.address

        const meta = document.createElement("p")
        meta.style.cssText = "margin:4px 0 0;font-weight:600"
        meta.style.color = PRIORITY_COLOR[properties.priority as OccurrencePriority] ?? "#525252"
        meta.textContent =
          `Prioridade ${PRIORITY_LABEL[properties.priority as OccurrencePriority] ?? "—"}`

        const unit = document.createElement("p")
        unit.style.cssText = "margin:0;color:#525252"
        unit.textContent = `Atendida por ${properties.unitLabel}`

        node.append(protocol, nature, address, meta, unit)

        if (openRef.current) {
          const button = document.createElement("button")
          button.type = "button"
          button.style.cssText =
            "margin-top:8px;font-weight:700;color:#DE5656;text-decoration:underline;"
            + "cursor:pointer;background:none;border:none;padding:0"
          button.textContent = "Abrir a ocorrência"
          button.addEventListener("click", () => openRef.current?.(properties.id))
          node.append(button)
        }
      }

      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
        .setLngLat(event.lngLat)
        .setDOMContent(node)
        .addTo(map)
    }

    map.on("click", POINT_LAYER, (event) => openPopup(event, "incident"))
    map.on("click", UNIT_LAYER, (event) => openPopup(event, "incident"))
    map.on("click", CLUSTER_LAYER, (event) => openPopup(event, "cluster"))

    for (const layer of [POINT_LAYER, UNIT_LAYER, CLUSTER_LAYER]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer" })
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = "" })
    }

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      markers.clear()
      setReady(false)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // -- data ------------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const source = map.getSource(POINT_SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData(data)
  }, [data, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const source = map.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData(clusterData)
  }, [clusterData, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    updateCoverageData(map, coverage)
    if (coverage) fitBoundsOf(map, coverage)
  }, [coverage, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const shown: Record<IncidentMapMode, string[]> = {
      heat: [HEAT_LAYER],
      points: [POINT_LAYER],
      coverage: [UNIT_LAYER],
      recurrence: [CLUSTER_LAYER, CLUSTER_LABEL],
    }

    for (const layer of [HEAT_LAYER, POINT_LAYER, UNIT_LAYER, CLUSTER_LAYER, CLUSTER_LABEL]) {
      map.setLayoutProperty(layer, "visibility", shown[mode].includes(layer) ? "visible" : "none")
    }

    // A popup describing a dot that is no longer drawn is a ghost.
    popupRef.current?.remove()
  }, [mode, ready])

  const stationSignature = (stations ?? [])
    .map((station) => `${station.id}:${station.latitude}:${station.longitude}`)
    .join("|")

  const stationsRef = useRef(stations)
  stationsRef.current = stations

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const markers = stationMarkers.current

    for (const station of stationsRef.current ?? []) {
      markers.set(
        station.id,
        createStationMarker(map, [station.longitude, station.latitude], station),
      )
    }

    return () => {
      markers.forEach((marker) => marker.remove())
      markers.clear()
    }
  }, [stationSignature, ready])

  // -- size ------------------------------------------------------------------

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement !== wrapRef.current) {
        setView((current) => (current === "full" ? "inline" : current))
      }
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = () => {
    const wrap = wrapRef.current
    if (!wrap) return

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
      return
    }

    wrap.requestFullscreen().then(() => setView("full")).catch(() => undefined)
  }

  const empty = mode === "recurrence"
    ? (clusters?.length ?? 0) === 0
    : incidents.length === 0

  return (
    <div ref={wrapRef} className={cn("map-wrap border", className)}>
      <div ref={containerRef} className="map" />

      <div className="top-controls">
        <div className="toggle-wrap">
          {MODES.map((option) => (
            <button
              key={option.value}
              className={mode === option.value ? "active" : ""}
              onClick={() => onModeChange(option.value)}
              title={option.title}
            >
              <option.Icon size={14} />
              <span className="view-label">{option.label}</span>
            </button>
          ))}
        </div>

        {/* No theater button here: this map already spans the page, so there is
            nowhere left in the page for it to expand into. */}
        <div className="toggle-wrap">
          <button
            className={cn("view", view === "full" && "active")}
            onClick={toggleFullscreen}
            title={view === "full" ? "Sair da tela cheia" : "Abrir em tela cheia"}
          >
            {view === "full" ? <Minimize size={14} /> : <Maximize size={14} />}
            <span className="view-label">Tela cheia</span>
          </button>
        </div>
      </div>

      {empty && (
        <p className="map-hint">
          {mode === "recurrence"
            ? "Nenhum endereço repetido no período filtrado"
            : "Nenhuma ocorrência no período filtrado"}
        </p>
      )}
    </div>
  )
}

/** The legend belongs to the page, not inside the map, so it can wrap freely. */
export function IncidentLegend({ mode, units }: {
  mode: IncidentMapMode
  units?: { label: string, color: string }[]
}) {
  if (mode === "heat") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
        <span>Menos</span>
        <span
          className="h-3 w-24 border border-neutral-300"
          style={{ background: "linear-gradient(90deg,#FEE2E2,#FCA5A5,#EF4444,#991B1B)" }}
        />
        <span>Mais ocorrências</span>
      </div>
    )
  }

  if (mode === "recurrence") {
    return (
      <p className="text-sm text-neutral-600">
        O círculo cresce com o número de chamados no mesmo endereço.
      </p>
    )
  }

  if (mode === "coverage") {
    return (
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
        {(units ?? []).map((unit) => (
          <li key={unit.label} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full border-2 border-white ring-1 ring-neutral-300"
              style={{ background: unit.color }}
            />
            {unit.label}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
      {(Object.keys(PRIORITY_COLOR) as OccurrencePriority[]).map((priority) => (
        <li key={priority} className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border-2 border-white ring-1 ring-neutral-300"
            style={{ background: PRIORITY_COLOR[priority] }}
          />
          {PRIORITY_LABEL[priority]}
        </li>
      ))}
    </ul>
  )
}
