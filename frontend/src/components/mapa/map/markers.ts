/**
 * Origin and destination pins, plus the arrow that plays the route back.
 *
 * The markers used to be added inside the layer setup from a constant. They
 * are created here and returned, so the map can move them when a new route
 * arrives instead of leaving a trail of stale pins behind.
 */

import maplibregl from "maplibre-gl"

import type { LngLat } from "@/components/mapa/routes/utils"

export function createMarker(
  map: maplibregl.Map,
  coords: LngLat,
  color: string,
  label: string,
  title: string,
): maplibregl.Marker {
  const element = document.createElement("div")

  element.style.cssText = `
    width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;
    box-shadow:0 0 14px ${color}99,0 2px 6px rgba(0,0,0,.45);
    display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:700;color:#fff;font-family:sans-serif;cursor:default;
  `

  element.textContent = label
  element.title = title

  return new maplibregl.Marker({ element }).setLngLat(coords).addTo(map)
}

/**
 * A fire station, drawn as a labelled pill instead of a plain dot.
 *
 * Choosing where a vehicle leaves from means comparing stations, and comparing
 * dots means hovering each one to find out which is which. The acronym travels
 * with the pin, and the selected station wears the same red as the route it is
 * the origin of.
 */
export function createStationMarker(
  map: maplibregl.Map,
  coords: LngLat,
  station: { acronym: string, name: string },
  options: { selected?: boolean, nearest?: boolean, onClick?: () => void } = {},
): maplibregl.Marker {
  const element = document.createElement("div")

  const background = options.selected ? "#DE5656" : options.nearest ? "#1565C0" : "#1F2937"

  element.style.cssText = `
    display:flex;align-items:center;gap:5px;
    padding:3px 9px 3px 6px;border-radius:999px;
    background:${background};border:2px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.45);
    font:700 11px/1 system-ui,sans-serif;color:#fff;
    letter-spacing:.3px;white-space:nowrap;
    cursor:${options.onClick ? "pointer" : "default"};
  `

  element.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/>
    </svg>
    <span></span>
  `

  // The acronym is written as text, never as markup: it comes from the unit
  // registry, which is user input.
  const label = element.querySelector("span")
  if (label) label.textContent = station.acronym

  element.title = options.nearest
    ? `${station.name} — o mais próximo do destino`
    : station.name

  if (options.onClick) {
    element.addEventListener("click", (event) => {
      // Without this the click also lands on the map, which on the routes
      // screen would move the destination to the station just picked.
      event.stopPropagation()
      options.onClick?.()
    })
  }

  return new maplibregl.Marker({ element }).setLngLat(coords).addTo(map)
}

const ARROW_ICON = "nav-arrow-icon"
const ARROW_SOURCE = "src-arrow"
const ARROW_LAYER = "layer-arrow"

function addArrowSourceAndLayer(map: maplibregl.Map, start: LngLat) {
  if (map.getLayer(ARROW_LAYER)) return

  if (!map.getSource(ARROW_SOURCE)) {
    map.addSource(ARROW_SOURCE, {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "Point", coordinates: start },
        properties: { bearing: 0 },
      },
    })
  }

  map.addLayer({
    id: ARROW_LAYER,
    type: "symbol",
    source: ARROW_SOURCE,
    layout: {
      "icon-image": ARROW_ICON,
      "icon-size": 0.9,
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-pitch-alignment": "map",
      "icon-allow-overlap": true,
      visibility: "none",
    },
  })
}

/**
 * Registers the navigation arrow, and is safe to call again.
 *
 * The icon decodes asynchronously, so the layer can still be missing when the
 * playback starts. Calling this from `startFollow` as well means the arrow is
 * there by the time it is asked to show, instead of silently doing nothing.
 */
export function addArrowLayer(map: maplibregl.Map, start: LngLat) {
  if (map.getLayer(ARROW_LAYER)) return

  if (map.hasImage(ARROW_ICON)) {
    addArrowSourceAndLayer(map, start)
    return
  }

  const size = 64

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64"
         xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="58" rx="14" ry="4" fill="rgba(0,0,0,0.25)"/>
      <path d="M32 4 L50 52 L32 42 L14 52 Z"
            fill="#1565C0" stroke="white" stroke-width="3"
            stroke-linejoin="round"/>
      <path d="M32 12 L44 46 L32 38 L20 46 Z"
            fill="rgba(255,255,255,0.18)"/>
    </svg>
  `

  const image = new Image()
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)

  image.onload = () => {
    // The map may already be gone by the time the icon arrives — a route swap
    // during playback, or the user navigating away.
    if (!map.getStyle()) return

    if (!map.hasImage(ARROW_ICON)) map.addImage(ARROW_ICON, image)
    addArrowSourceAndLayer(map, start)
  }
}

export function showArrow(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer(ARROW_LAYER)) return
  map.setLayoutProperty(ARROW_LAYER, "visibility", visible ? "visible" : "none")
}

export function moveArrow(map: maplibregl.Map, coords: LngLat, bearing: number) {
  const source = map.getSource(ARROW_SOURCE) as maplibregl.GeoJSONSource | undefined

  source?.setData({
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: { bearing },
  })
}
