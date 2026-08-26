/**
 * The route layers.
 *
 * Two stacks are drawn from the same data: a flat one for the 2D view and one
 * lifted to `ROUTE_ALT` metres for the 3D view, toggled by visibility so a
 * mode change costs nothing.
 *
 * A second, dimmer line carries the comparison route. Showing the neural route
 * and the shortest-in-metres route side by side is the whole point of the
 * project, and on a map the difference has to be visible, not tabulated.
 */

import maplibregl from "maplibre-gl"
import type { Feature, LineString } from "geojson"

import { ROUTE_ALT, ROUTE_COLOR } from "@/components/mapa/constants/constants"
import type { LngLat } from "@/components/mapa/routes/utils"

const COMPARISON_COLOR = "#1565C0"

const FLAT_SOURCE = "src-flat"
const LIFTED_SOURCE = "src-lifted"
const COMPARISON_SOURCE = "src-comparison"

const LAYERS_2D = ["comparison-2d", "glow-2d", "line-2d", "dash-2d"]
const LAYERS_3D = ["shadow-3d", "glow-3d", "line-3d", "dash-3d"]

function lineFeature(coords: number[][]): Feature<LineString> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {},
  }
}

const lift = (coords: LngLat[]) =>
  coords.map(([lng, lat]) => [lng, lat, ROUTE_ALT])

export function addRouteLayers(map: maplibregl.Map, coords: LngLat[], comparison: LngLat[]) {
  map.addSource(FLAT_SOURCE, { type: "geojson", data: lineFeature(coords) })
  map.addSource(LIFTED_SOURCE, { type: "geojson", data: lineFeature(lift(coords)) })
  map.addSource(COMPARISON_SOURCE, { type: "geojson", data: lineFeature(comparison) })

  // The comparison goes down first so the main route always draws over it.
  map.addLayer({
    id: "comparison-2d",
    type: "line",
    source: COMPARISON_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": COMPARISON_COLOR,
      "line-width": 5,
      "line-opacity": 0.75,
      "line-dasharray": [2, 2],
    },
  })

  map.addLayer({
    id: "glow-2d",
    type: "line",
    source: FLAT_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ROUTE_COLOR, "line-width": 18, "line-opacity": 0.18, "line-blur": 4 },
  })

  map.addLayer({
    id: "line-2d",
    type: "line",
    source: FLAT_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ROUTE_COLOR, "line-width": 6, "line-opacity": 1 },
  })

  map.addLayer({
    id: "dash-2d",
    type: "line",
    source: FLAT_SOURCE,
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: { "line-color": "#fff", "line-width": 1.5, "line-dasharray": [4, 6], "line-opacity": 0.35 },
  })

  map.addLayer({
    id: "shadow-3d",
    type: "line",
    source: FLAT_SOURCE,
    layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
    paint: { "line-color": "#000", "line-width": 8, "line-opacity": 0.2, "line-blur": 4 },
  })

  map.addLayer({
    id: "glow-3d",
    type: "line",
    source: LIFTED_SOURCE,
    layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
    paint: { "line-color": ROUTE_COLOR, "line-width": 24, "line-opacity": 0.18, "line-blur": 7 },
  })

  map.addLayer({
    id: "line-3d",
    type: "line",
    source: LIFTED_SOURCE,
    layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
    paint: { "line-color": ROUTE_COLOR, "line-width": 7, "line-opacity": 1 },
  })

  map.addLayer({
    id: "dash-3d",
    type: "line",
    source: LIFTED_SOURCE,
    layout: { "line-cap": "butt", "line-join": "round", visibility: "none" },
    paint: { "line-color": "#fff", "line-width": 2, "line-dasharray": [4, 6], "line-opacity": 0.4 },
  })
}

/** Redraws both stacks when a new route arrives, without rebuilding the map. */
export function updateRouteData(map: maplibregl.Map, coords: LngLat[], comparison: LngLat[]) {
  const flat = map.getSource(FLAT_SOURCE) as maplibregl.GeoJSONSource | undefined
  const lifted = map.getSource(LIFTED_SOURCE) as maplibregl.GeoJSONSource | undefined
  const other = map.getSource(COMPARISON_SOURCE) as maplibregl.GeoJSONSource | undefined

  flat?.setData(lineFeature(coords))
  lifted?.setData(lineFeature(lift(coords)))
  other?.setData(lineFeature(comparison))
}

export function setComparisonVisibility(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer("comparison-2d")) return
  map.setLayoutProperty("comparison-2d", "visibility", visible ? "visible" : "none")
}

export function setLayerVisibility(map: maplibregl.Map, show3d: boolean) {
  const flatVisibility = show3d ? "none" : "visible"
  const liftedVisibility = show3d ? "visible" : "none"

  LAYERS_2D.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", flatVisibility)
  })

  LAYERS_3D.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", liftedVisibility)
  })
}

export function setBuildingLayersVisibility(map: maplibregl.Map, visible: boolean) {
  const visibility = visible ? "visible" : "none"

  map.getStyle().layers.forEach((layer) => {
    if (layer.id.toLowerCase().includes("building")) {
      map.setLayoutProperty(layer.id, "visibility", visibility)
    }
  })
}
