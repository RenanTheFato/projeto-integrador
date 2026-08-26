/**
 * The route map.
 *
 * Same map the first version of the interface shipped — 2D/3D toggle, the
 * orbit intro and the Waze-style playback — but the geometry now arrives as a
 * prop instead of being a constant, so it draws whatever the AI answered for
 * the incident on screen.
 *
 * The API sends coordinates as `[latitude, longitude]` and MapLibre wants
 * `[longitude, latitude]`. `toMapCoords` performs that swap once, here.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Box, ChevronDown, Globe, Map as MapIcon, MapPinOff, Navigation } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import type { CamMode } from "./types/types"
import { ORBIT_PERIOD, STYLE, WAZE_PITCH, WAZE_ZOOM } from "./constants/constants"
import {
  bearingBetween, measureRoute, toMapCoords,
} from "./routes/utils"
import type { LngLat, RouteMetrics } from "./routes/utils"
import { addArrowLayer, createMarker, moveArrow, showArrow } from "./map/markers"
import {
  addRouteLayers, setBuildingLayersVisibility, setComparisonVisibility,
  setLayerVisibility, updateRouteData,
} from "./map/layers"
import { fitRoute } from "./map/helpers"
import { cn } from "@/lib/utils"

import "./mapa.css"

export interface RouteMapProps {
  /** Main route, as the API sends it: `[latitude, longitude]` pairs. */
  route: [number, number][] | null | undefined
  /** Optional second route drawn dimmed underneath, for the comparison. */
  comparison?: [number, number][] | null
  originLabel?: string
  destinationLabel?: string
  /** Tailwind height/width for the frame; the map fills it absolutely. */
  className?: string
  emptyMessage?: string
}

export default function RouteMap({
  route,
  comparison,
  originLabel = "Origem",
  destinationLabel = "Destino",
  className,
  emptyMessage = "Nenhuma rota para exibir",
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const originMarker = useRef<maplibregl.Marker | null>(null)
  const destinationMarker = useRef<maplibregl.Marker | null>(null)

  const orbitRAF = useRef<number | null>(null)
  const orbitStart = useRef<number | null>(null)

  const followRAF = useRef<number | null>(null)
  const followStart = useRef<number | null>(null)

  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d")
  const [orbitDone, setOrbitDone] = useState(false)
  const [camMode, setCamMode] = useState<CamMode>("free")
  const [dropOpen, setDropOpen] = useState(false)
  const [showComparison, setShowComparison] = useState(true)

  const coords = useMemo(() => toMapCoords(route), [route])
  const comparisonCoords = useMemo(() => toMapCoords(comparison), [comparison])
  const metrics = useMemo(() => measureRoute(coords), [coords])

  // The map is built once and then fed; the animations read the current route
  // through this ref so they never close over a stale one.
  const metricsRef = useRef<RouteMetrics>(metrics)
  metricsRef.current = metrics

  const hasRoute = coords.length > 1

  // -- Camera control --------------------------------------------------------

  const enableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.enable()
    map.scrollZoom.enable()
    map.dragRotate.enable()
    map.touchZoomRotate.enable()
  }

  const disableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.disable()
    map.scrollZoom.disable()
    map.dragRotate.disable()
    map.touchZoomRotate.disable()
  }

  const stopOrbit = () => {
    if (orbitRAF.current !== null) {
      cancelAnimationFrame(orbitRAF.current)
      orbitRAF.current = null
    }
    orbitStart.current = null
  }

  const stopFollow = () => {
    if (followRAF.current !== null) {
      cancelAnimationFrame(followRAF.current)
      followRAF.current = null
    }
    followStart.current = null
  }

  // -- Map lifecycle ---------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !hasRoute) return

    const current = metricsRef.current

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: current.center,
      zoom: 13.5,
      pitch: 0,
      bearing: 0,
    })

    mapRef.current = map

    map.on("load", () => {
      const live = metricsRef.current

      addRouteLayers(map, live.coords, comparisonCoords)
      addArrowLayer(map, live.coords[0] ?? [0, 0])
      fitRoute(map, live.coords)

      map.setMaxPitch(0)
      map.setMinZoom(10)
      map.setMaxZoom(16)

      setBuildingLayersVisibility(map, false)

      originMarker.current = createMarker(map, live.coords[0], "#E53935", "B", originLabel)
      destinationMarker.current = createMarker(
        map, live.coords[live.coords.length - 1], "#FFB300", "!", destinationLabel,
      )
    })

    return () => {
      stopOrbit()
      stopFollow()
      originMarker.current = null
      destinationMarker.current = null
      map.remove()
      mapRef.current = null
    }
    // The map is intentionally built once; route changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoute])

  // A new route replaces the geometry in place rather than rebuilding the map,
  // which would cost a full style download on every incident selected.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasRoute || !map.isStyleLoaded()) return

    stopFollow()
    showArrow(map, false)
    setCamMode("free")

    updateRouteData(map, coords, comparisonCoords)

    originMarker.current?.setLngLat(coords[0])
    destinationMarker.current?.setLngLat(coords[coords.length - 1])

    fitRoute(map, coords)
  }, [coords, comparisonCoords, hasRoute])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    setComparisonVisibility(map, showComparison && comparisonCoords.length > 1)
  }, [showComparison, comparisonCoords])

  // -- Orbit intro -----------------------------------------------------------

  const startOrbit = (map: maplibregl.Map) => {
    stopOrbit()

    setOrbitDone(false)
    orbitStart.current = null

    disableFreeCamera(map)

    const { center, radius } = metricsRef.current
    const targetZoom = Math.max(12, Math.min(15.5, 15.3 - radius * 60))

    map.flyTo({
      center,
      zoom: targetZoom,
      pitch: 60,
      bearing: 0,
      duration: 1400,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    })

    map.once("moveend", () => {
      orbitStart.current = null

      const loop = (timestamp: number) => {
        if (orbitStart.current === null) orbitStart.current = timestamp

        const progress = (timestamp - orbitStart.current) / ORBIT_PERIOD

        if (progress >= 1) {
          map.setBearing(0)
          stopOrbit()
          enableFreeCamera(map)
          setOrbitDone(true)
          setCamMode("free")
          return
        }

        map.setBearing(progress * 360)
        orbitRAF.current = requestAnimationFrame(loop)
      }

      orbitRAF.current = requestAnimationFrame(loop)
    })
  }

  // -- Route playback --------------------------------------------------------

  const startFollow = (map: maplibregl.Map) => {
    stopFollow()

    const live = metricsRef.current
    if (live.coords.length < 2) return

    disableFreeCamera(map)
    followStart.current = null
    showArrow(map, true)

    const initialBearing = bearingBetween(live.coords[0], live.coords[1])

    map.flyTo({
      center: live.coords[0],
      zoom: WAZE_ZOOM,
      pitch: WAZE_PITCH,
      bearing: initialBearing,
      duration: 1200,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    })

    map.once("moveend", () => {
      followStart.current = null

      const loop = (timestamp: number) => {
        if (followStart.current === null) followStart.current = timestamp

        const { totalMeters, followDurationMs, pointAtDist } = metricsRef.current
        const elapsed = timestamp - followStart.current
        const travelled = (elapsed / followDurationMs) * totalMeters

        if (travelled >= totalMeters) {
          stopFollow()
          enableFreeCamera(map)
          setCamMode("free")
          showArrow(map, false)
          return
        }

        const position = pointAtDist(travelled)
        // Aiming 20 m ahead keeps the heading from twitching on short segments.
        const ahead = pointAtDist(Math.min(travelled + 20, totalMeters))
        const bearing = bearingBetween(position, ahead)

        moveArrow(map, position, bearing)
        map.jumpTo({ center: position, bearing, pitch: WAZE_PITCH, zoom: WAZE_ZOOM })

        followRAF.current = requestAnimationFrame(loop)
      }

      followRAF.current = requestAnimationFrame(loop)
    })
  }

  const handleCamModeChange = (next: CamMode) => {
    const map = mapRef.current
    if (!map) return

    setDropOpen(false)
    if (next === camMode) return

    setCamMode(next)

    if (next === "free") {
      stopFollow()
      showArrow(map, false)
      enableFreeCamera(map)
    } else {
      startFollow(map)
    }
  }

  const handleToggle = () => {
    const map = mapRef.current
    if (!map) return

    if (mapMode === "2d") {
      setMapMode("3d")
      setOrbitDone(false)
      setCamMode("free")

      setLayerVisibility(map, true)

      map.setMaxPitch(85)
      map.setMinZoom(10)
      map.setMaxZoom(20)

      setBuildingLayersVisibility(map, true)
      startOrbit(map)
    } else {
      setMapMode("2d")
      setOrbitDone(false)

      stopOrbit()
      stopFollow()
      showArrow(map, false)

      setLayerVisibility(map, false)

      map.setMaxPitch(0)
      map.setMaxZoom(16)

      setBuildingLayersVisibility(map, false)
      enableFreeCamera(map)

      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
        easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
      })

      window.setTimeout(() => fitRoute(map, metricsRef.current.coords), 820)
    }
  }

  const CAM_OPTIONS: { value: CamMode, label: string, Icon: React.ElementType }[] = [
    { value: "free", label: "Livre", Icon: Globe },
    { value: "follow", label: "Seguir Rota", Icon: Navigation },
  ]

  const currentCam = CAM_OPTIONS.find((option) => option.value === camMode) ?? CAM_OPTIONS[0]
  const CurrentCamIcon = currentCam.Icon

  if (!hasRoute) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 border bg-white", className)}>
        <MapPinOff className="h-12 w-12 text-neutral-400" />
        <p className="text-neutral-600">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn("map-wrap border", className)}>
      <div ref={containerRef} className="map" />

      <div className="top-controls">
        <div className="toggle-wrap">
          <button className={mapMode === "2d" ? "active" : ""} onClick={() => mapMode !== "2d" && handleToggle()}>
            <MapIcon size={14} />
            2D
          </button>

          <button className={mapMode === "3d" ? "active" : ""} onClick={() => mapMode !== "3d" && handleToggle()}>
            <Box size={14} />
            3D
          </button>
        </div>

        {comparisonCoords.length > 1 && (
          <div className="toggle-wrap">
            <button
              className={showComparison ? "active" : ""}
              onClick={() => setShowComparison((value) => !value)}
              title="Mostrar também a rota mais curta em metros"
            >
              Comparar
            </button>
          </div>
        )}

        {mapMode === "3d" && orbitDone && (
          <div className="cam-dropdown">
            <div className={`cam-trigger ${dropOpen ? "open" : ""}`} onClick={() => setDropOpen((value) => !value)}>
              <CurrentCamIcon size={14} style={{ opacity: 0.7 }} />
              {currentCam.label}
              <ChevronDown size={12} className={`cam-chevron ${dropOpen ? "open" : ""}`} />
            </div>

            {dropOpen && (
              <div className="cam-menu">
                {CAM_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`cam-option ${camMode === option.value ? "selected" : ""}`}
                    onClick={() => handleCamModeChange(option.value)}
                  >
                    <option.Icon size={14} />
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export type { LngLat }
