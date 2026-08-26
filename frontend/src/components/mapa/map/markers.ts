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

export function addArrowLayer(map: maplibregl.Map, start: LngLat) {
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
    // The image loads asynchronously, so the map may already be gone by the
    // time it arrives — a route swap during playback, or the user navigating.
    if (!map.getStyle()) return

    if (!map.hasImage("nav-arrow-icon")) map.addImage("nav-arrow-icon", image)
    if (map.getSource("src-arrow")) return

    map.addSource("src-arrow", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "Point", coordinates: start },
        properties: { bearing: 0 },
      },
    })

    map.addLayer({
      id: "layer-arrow",
      type: "symbol",
      source: "src-arrow",
      layout: {
        "icon-image": "nav-arrow-icon",
        "icon-size": 0.9,
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-allow-overlap": true,
        visibility: "none",
      },
    })
  }
}

export function showArrow(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer("layer-arrow")) return
  map.setLayoutProperty("layer-arrow", "visibility", visible ? "visible" : "none")
}

export function moveArrow(map: maplibregl.Map, coords: LngLat, bearing: number) {
  const source = map.getSource("src-arrow") as maplibregl.GeoJSONSource | undefined

  source?.setData({
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: { bearing },
  })
}
