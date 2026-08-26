/**
 * Geometry helpers for a route.
 *
 * These used to close over a hard-coded list of waypoints, which meant the map
 * could only ever draw one demo route. They are now pure functions of the
 * coordinates handed in, so the same map renders whatever the AI returns.
 *
 * Everything here works in MapLibre's axis order, `[longitude, latitude]`.
 * The API sends `[latitude, longitude]`, and `toMapCoords` is the single place
 * that swaps them.
 */

import { FOLLOW_KMH } from "../constants/constants"

export type LngLat = [number, number]

/** API geometry (`[lat, lon]`) into MapLibre order (`[lon, lat]`). */
export function toMapCoords(geometry: [number, number][] | null | undefined): LngLat[] {
  if (!geometry) return []
  return geometry.map(([latitude, longitude]) => [longitude, latitude] as LngLat)
}

export function routeCenter(coords: LngLat[]): LngLat {
  if (coords.length === 0) return [0, 0]

  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])

  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ]
}

export function routeRadius(coords: LngLat[]): number {
  if (coords.length === 0) return 0

  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])

  return Math.max(
    (Math.max(...lngs) - Math.min(...lngs)) / 2,
    (Math.max(...lats) - Math.min(...lats)) / 2,
  )
}

export function haversineMt(a: LngLat, b: LngLat): number {
  const R = 6_371_000

  const f1 = (a[1] * Math.PI) / 180
  const f2 = (b[1] * Math.PI) / 180

  const df = ((b[1] - a[1]) * Math.PI) / 180
  const dl = ((b[0] - a[0]) * Math.PI) / 180

  const s =
    Math.sin(df / 2) ** 2 +
    Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function bearingBetween(a: LngLat, b: LngLat): number {
  const f1 = (a[1] * Math.PI) / 180
  const f2 = (b[1] * Math.PI) / 180

  const dl = ((b[0] - a[0]) * Math.PI) / 180

  const y = Math.sin(dl) * Math.cos(f2)
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)

  return (Math.atan2(y, x) * 180) / Math.PI
}

/**
 * Everything the camera animations need about one route, computed once per
 * route instead of on every animation frame.
 */
export interface RouteMetrics {
  coords: LngLat[]
  cumulative: number[]
  totalMeters: number
  center: LngLat
  radius: number
  followDurationMs: number
  /** Interpolates the point `d` metres along the route. */
  pointAtDist: (d: number) => LngLat
}

export function measureRoute(coords: LngLat[]): RouteMetrics {
  const cumulative = [0]

  for (let i = 0; i < coords.length - 1; i++) {
    cumulative.push(cumulative[i] + haversineMt(coords[i], coords[i + 1]))
  }

  const totalMeters = cumulative[cumulative.length - 1] ?? 0

  const pointAtDist = (d: number): LngLat => {
    if (coords.length === 0) return [0, 0]
    if (coords.length === 1) return coords[0]

    const clamped = Math.min(Math.max(d, 0), totalMeters)

    let i = 0
    while (i < cumulative.length - 2 && cumulative[i + 1] < clamped) i++

    const segment = cumulative[i + 1] - cumulative[i]
    const f = segment > 0 ? (clamped - cumulative[i]) / segment : 0

    const a = coords[i]
    const b = coords[Math.min(i + 1, coords.length - 1)]

    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }

  return {
    coords,
    cumulative,
    totalMeters,
    center: routeCenter(coords),
    radius: routeRadius(coords),
    // The original playback speed: a walkthrough, not a simulation.
    followDurationMs: (totalMeters / 1000 / FOLLOW_KMH) * 1_600_000,
    pointAtDist,
  }
}
