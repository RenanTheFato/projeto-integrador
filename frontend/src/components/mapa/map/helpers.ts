import maplibregl from "maplibre-gl"

import type { GraphBounds } from "@/api/types"

/**
 * `essential: true` on every camera move.
 *
 * Without it MapLibre skips the animation when the browser reports
 * `prefers-reduced-motion` — which Windows does whenever "show animations" is
 * off — and the `moveend` that the orbit and the playback wait for fires
 * synchronously, before anything is listening for it.
 */
export const fitRoute = (
  map: maplibregl.Map,
  coords: [number, number][]
) => {
  if (coords.length === 0) return

  const bounds = new maplibregl.LngLatBounds()

  coords.forEach((c) => bounds.extend(c))

  map.fitBounds(bounds, {
    padding: 80,
    duration: 800,
    essential: true,
  })
}

/** Frames the whole area the street graph covers. */
export const fitBoundsOf = (map: maplibregl.Map, bounds: GraphBounds) => {
  map.fitBounds(
    new maplibregl.LngLatBounds(
      [bounds.min_longitude, bounds.min_latitude],
      [bounds.max_longitude, bounds.max_latitude],
    ),
    { padding: 40, duration: 800, essential: true },
  )
}
