/**
 * Layers that annotate a route rather than draw it.
 *
 * The explanation layer paints each edge of the IA route by the speed the
 * network predicts for it; the closures layer shows the circles the dispatcher
 * marked as blocked. Both are created lazily on first use and only ever have
 * their data replaced, so toggling them never rebuilds the map.
 */

import maplibregl from "maplibre-gl"

import type { Closure, RouteSegment } from "@/api/types"
import { SPEED_BAND_COLOR, speedBand } from "@/lib/route-language"

const SPEED_SOURCE = "speed-overlay"
const SPEED_CASING = "speed-overlay-casing"
const SPEED_LINE = "speed-overlay-line"
const CLOSURE_SOURCE = "closures"
const CLOSURE_FILL = "closures-fill"
const CLOSURE_LINE = "closures-line"
const CLOSURE_CENTER = "closures-center"

/** The vehicle layers must stay above any annotation. */
function firstVehicleLayer(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.id.startsWith("layer-route-firetruck"))?.id
}

const empty = (): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: [] })

/**
 * Paint the route by predicted speed. `geometry` is the route as the API sends
 * it ([latitude, longitude]); `segments` index into it.
 */
export function setSpeedOverlay(
  map: maplibregl.Map,
  geometry: [number, number][] | null | undefined,
  segments: RouteSegment[] | null | undefined,
) {
  const data = empty()

  if (geometry && segments) {
    for (const segment of segments) {
      const slice = geometry.slice(segment.start, segment.end + 1)
      if (slice.length < 2) continue
      data.features.push({
        type: "Feature",
        properties: { color: SPEED_BAND_COLOR[speedBand(segment)] },
        geometry: { type: "LineString", coordinates: slice.map(([latitude, longitude]) => [longitude, latitude]) },
      })
    }
  }

  const source = map.getSource(SPEED_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (source) {
    source.setData(data)
    return
  }

  map.addSource(SPEED_SOURCE, { type: "geojson", data })
  const before = firstVehicleLayer(map)
  map.addLayer({
    id: SPEED_CASING,
    type: "line",
    source: SPEED_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#0F1720", "line-width": 9, "line-opacity": 0.55 },
  }, before)
  map.addLayer({
    id: SPEED_LINE,
    type: "line",
    source: SPEED_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 6 },
  }, before)
}

/** A circle as a 48-sided polygon, in metres around its centre. */
export function circlePolygon(closure: Closure, sides = 48): [number, number][] {
  const metersPerDegreeLat = 111_320
  const metersPerDegreeLon = 111_320 * Math.cos((closure.latitude * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let index = 0; index <= sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2
    ring.push([
      closure.longitude + (Math.cos(angle) * closure.radius_m) / metersPerDegreeLon,
      closure.latitude + (Math.sin(angle) * closure.radius_m) / metersPerDegreeLat,
    ])
  }
  return ring
}

export function setClosures(map: maplibregl.Map, closures: Closure[] | null | undefined) {
  const data = empty()

  for (const closure of closures ?? []) {
    data.features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [circlePolygon(closure)] },
    })
    data.features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [closure.longitude, closure.latitude] },
    })
  }

  const source = map.getSource(CLOSURE_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (source) {
    source.setData(data)
    return
  }

  map.addSource(CLOSURE_SOURCE, { type: "geojson", data })
  const before = firstVehicleLayer(map)
  map.addLayer({
    id: CLOSURE_FILL,
    type: "fill",
    source: CLOSURE_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#A32A20", "fill-opacity": 0.18 },
  }, before)
  map.addLayer({
    id: CLOSURE_LINE,
    type: "line",
    source: CLOSURE_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#A32A20", "line-width": 2, "line-dasharray": [2, 1.5] },
  }, before)
  map.addLayer({
    id: CLOSURE_CENTER,
    type: "circle",
    source: CLOSURE_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 5,
      "circle-color": "#A32A20",
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  }, before)
}
