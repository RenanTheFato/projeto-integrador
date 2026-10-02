/**
 * Response-time coverage on the map.
 *
 * Nested isochrones (darkest is the fastest band), the stations they leave
 * from, and recent occurrences coloured by whether the network says they were
 * reachable inside the target time. A click places a hypothetical station when
 * the page asks for one.
 */

import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import type { CoverageArea, CoveragePoint, CoverageStation, WaterSource } from "@/api/types"
import { STYLE } from "./constants/constants"
import { createMarker, createStationMarker } from "./map/markers"
import { cn } from "@/lib/utils"
import { POINT_COLOR, pointClass } from "./coverage-palette"

import "./mapa.css"

const CENTER: [number, number] = [-45.5551, -23.0264]

/** Fastest band darkest; the palette is the console's accent, never a rainbow. */
const BAND_FILL = ["#0B63A5", "#3B86C0", "#8DB6D8", "#C4D9EA", "#DCE8F2", "#EDF3F8"]


const WATER_COLOR: Record<WaterSource["status"], string> = {
  OPERANTE: "#0E6E75",
  NAO_VERIFICADO: "#B07A12",
  INOPERANTE: "#A32A20",
}

export default function CoverageMap({ areas, stations, points, targetMinutes, waterSources, onPick, className }: {
  areas: CoverageArea[]
  stations: CoverageStation[]
  points: CoveragePoint[]
  targetMinutes: number
  waterSources?: WaterSource[]
  onPick?: (latitude: number, longitude: number) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const pickRef = useRef(onPick)
  const [ready, setReady] = useState(false)
  const fitted = useRef(false)

  useEffect(() => { pickRef.current = onPick }, [onPick])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: CENTER,
      zoom: 11.5,
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    })
    mapRef.current = map
    map.getCanvas().setAttribute("aria-label", "Mapa de cobertura por tempo de resposta")
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left")

    map.on("load", () => {
      map.addSource("coverage-areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addSource("coverage-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addSource("water-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addLayer({
        id: "coverage-fill",
        type: "fill",
        source: "coverage-areas",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.32 },
      })
      map.addLayer({
        id: "coverage-outline",
        type: "line",
        source: "coverage-areas",
        paint: { "line-color": "#084D80", "line-width": ["get", "width"], "line-opacity": 0.75 },
      })
      map.addLayer({
        id: "coverage-points",
        type: "circle",
        source: "coverage-points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.8, 14, 4],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
        },
      })
      map.addLayer({
        id: "water-points",
        type: "circle",
        source: "water-points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 6],
          "circle-color": "#FFFFFF",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
        },
      })
      setReady(true)
    })

    map.on("click", (event) => {
      if (!pickRef.current) return
      pickRef.current(event.lngLat.lat, event.lngLat.lng)
    })

    return () => {
      markers.current.forEach((marker) => marker.remove())
      markers.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = onPick ? "crosshair" : ""
  }, [onPick])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    // Largest first, so the faster bands paint on top of the slower ones.
    const sorted = [...areas].sort((a, b) => b.minutes - a.minutes)
    const features: GeoJSON.Feature[] = sorted.flatMap((area) => {
      if (!area.geometry) return []
      const rank = [...areas].sort((a, b) => a.minutes - b.minutes).findIndex((item) => item.minutes === area.minutes)
      return [{
        type: "Feature" as const,
        properties: { minutes: area.minutes, color: BAND_FILL[rank] ?? BAND_FILL[BAND_FILL.length - 1], width: area.minutes === targetMinutes ? 2.4 : 0.8 },
        geometry: area.geometry,
      }]
    })
    ;(map.getSource("coverage-areas") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features })

    if (!fitted.current && features.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      for (const feature of features) {
        for (const polygon of (feature.geometry as GeoJSON.MultiPolygon).coordinates) {
          for (const [longitude, latitude] of polygon[0]) bounds.extend([longitude, latitude])
        }
      }
      map.fitBounds(bounds, { padding: 30, duration: 0 })
      fitted.current = true
    }
  }, [areas, targetMinutes, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const maxMinutes = Math.max(...areas.map((area) => area.minutes), targetMinutes)
    ;(map.getSource("coverage-points") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        properties: { color: POINT_COLOR[pointClass(point, targetMinutes, maxMinutes)] },
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
      })),
    })
  }, [points, targetMinutes, areas, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;(map.getSource("water-points") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (waterSources ?? []).map((source) => ({
        type: "Feature",
        properties: { color: WATER_COLOR[source.status] },
        geometry: { type: "Point", coordinates: [Number(source.longitude), Number(source.latitude)] },
      })),
    })
  }, [waterSources, ready])

  const stationSignature = stations.map((station) => `${station.id}:${station.latitude}:${station.longitude}`).join("|")

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    markers.current.forEach((marker) => marker.remove())
    markers.current = stations.filter((station) => station.in_network).map((station) => station.hypothetical
      ? createMarker(map, [station.longitude, station.latitude], "#8E600A", "+", station.name)
      : createStationMarker(map, [station.longitude, station.latitude], station))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationSignature, ready])

  return <div ref={containerRef} className={cn("relative overflow-hidden rounded-sm border border-line", className)} />
}
