export interface Waypoint {
  name: string
  coordinates: [number, number] // [lng, lat]
}

export type CamMode = "free" | "follow"