/**
 * A vehicle driving its route at the model's predicted pace, sped up for a
 * demonstration. It is what lets the console show tracking and guidance
 * without a tablet on a real truck.
 */

import { useEffect, useMemo, useRef, useState } from "react"

import { cumulative, pointAlong } from "@/lib/guidance"
import type { LatLon } from "@/lib/guidance"

export function useRouteSimulation(geometry: LatLon[] | null, totalSeconds: number) {
  const along = useMemo(() => cumulative(geometry ?? []), [geometry])
  const total = along[along.length - 1] ?? 0

  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [meters, setMeters] = useState(0)
  const metersRef = useRef(0)

  useEffect(() => {
    if (!running || total <= 0 || totalSeconds <= 0) return
    const metersPerSecond = total / totalSeconds
    let last = performance.now()

    const timer = window.setInterval(() => {
      const now = performance.now()
      const next = Math.min(total, metersRef.current + metersPerSecond * speed * ((now - last) / 1000))
      last = now
      metersRef.current = next
      setMeters(next)
      if (next >= total) setRunning(false)
    }, 250)

    return () => window.clearInterval(timer)
  }, [running, speed, total, totalSeconds])

  const position: LatLon | null = geometry && meters > 0 ? pointAlong(geometry, meters, along) : null

  return {
    position,
    running,
    speed,
    progress: total > 0 ? meters / total : 0,
    setSpeed,
    toggle: () => {
      if (!running && metersRef.current >= total) {
        metersRef.current = 0
        setMeters(0)
      }
      setRunning((value) => !value)
    },
  }
}
