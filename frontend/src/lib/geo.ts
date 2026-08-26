/**
 * Distance between two points on the ground.
 *
 * A straight line is not a drive, and the AI is the one that answers how long
 * a drive takes — but asking it costs a request per candidate. For ranking a
 * handful of stations around a city ten kilometres across, a great-circle
 * distance is close enough to pick the right one and is free, so the interface
 * suggests with this and confirms with the model.
 */

import type { Unit } from "@/api/types"
import { toNumber } from "@/lib/format"

const EARTH_RADIUS_M = 6_371_000

export interface Point {
  latitude: number
  longitude: number
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export function distanceMeters(from: Point, to: Point): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude)
  const deltaLongitude = toRadians(to.longitude - from.longitude)

  const a =
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(from.latitude))
      * Math.cos(toRadians(to.latitude))
      * Math.sin(deltaLongitude / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** The closest candidate to `target`, or null when there are no candidates. */
export function nearestTo<T extends Point>(
  target: Point,
  candidates: T[],
): { item: T, meters: number } | null {
  let best: { item: T, meters: number } | null = null

  for (const candidate of candidates) {
    const meters = distanceMeters(target, candidate)
    if (!best || meters < best.meters) best = { item: candidate, meters }
  }

  return best
}

export interface Station extends Point {
  id: string
  acronym: string
  name: string
}

/**
 * The units that belong on a map of the city.
 *
 * The registry is a hierarchy: above the posts sit a regional command in
 * Campinas and a general command in São Paulo, and those are real units with
 * real coordinates a hundred kilometres away. They are not places a vehicle
 * leaves from, so plotting them puts pins outside the city and lists commands
 * in a legend of stations. Only posts and sub-groups house vehicles, and a unit
 * with no coordinates cannot be plotted at all.
 */
export function stationsOf(units: Unit[] | undefined): Station[] {
  return (units ?? []).flatMap((unit) => {
    if (unit.type !== "POSTO" && unit.type !== "SUBGRUPAMENTO") return []

    const latitude = toNumber(unit.latitude)
    const longitude = toNumber(unit.longitude)
    if (latitude === null || longitude === null) return []

    return [{ id: unit.id, acronym: unit.acronym, name: unit.name, latitude, longitude }]
  })
}
