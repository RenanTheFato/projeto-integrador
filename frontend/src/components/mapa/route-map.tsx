/**
 * The route map.
 *
 * Operational 2D/3D map with route playback and synchronized vehicle comparison.
 * Geometry comes from the API for the incident on screen.
 *
 * The API sends coordinates as `[latitude, longitude]` and MapLibre wants
 * `[longitude, latitude]`. `toMapCoords` performs that swap once, here.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Box, Globe, LocateFixed, Map as MapIcon, MapPinOff, Maximize, Maximize2, Minimize,
  Minimize2, Navigation, Pause, Play, Square,
} from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import type { Closure, GraphBounds, RouteSegment } from "@/api/types"
import type { CamMode } from "./types/types"
import { STYLE, WAZE_PITCH, WAZE_ZOOM } from "./constants/constants"
import { bearingBetween, measureRoute, toMapCoords } from "./routes/utils"
import type { LngLat, RouteMetrics } from "./routes/utils"
import {
  addArrowLayer, createMarker, createStationMarker, moveArrow, showArrow, showComparisonVehicle,
} from "./map/markers"
import {
  addCoverageLayer, addRouteLayers, set3DEnvironment, setBuildingLayersVisibility,
  setComparisonVisibility, setLayerVisibility, updateCoverageData, updateRouteData,
} from "./map/layers"
import { startComparisonPlayback } from "./map/comparison-playback"
import { fitBoundsOf, observeMapToolbar } from "./map/helpers"
import { setClosures, setSpeedOverlay } from "./map/overlays"
import { formatDistance } from "@/lib/format"
import { cn } from "@/lib/utils"

import "./mapa.css"

/** Taubaté's centre, used until there is a route or a coverage rectangle. */
const FALLBACK_CENTER: LngLat = [-45.5551, -23.0264]

/**
 * Whether the browser's own fullscreen is engaged.
 *
 * Theater is deliberately *not* here. A map that floats over the page is a
 * different thing from a map that is simply given the room — and the room is
 * what a dispatcher actually wants, laid out like the statistics screen, with
 * the page still readable around it. Only the page knows how to give that up,
 * so theater is the page's state and arrives as a prop; this component just
 * asks for it.
 */
type MapView = "inline" | "full"

/** A station as the map needs it: a name to show and a point to show it at. */
export interface MapStation {
  id: string
  acronym: string
  name: string
  latitude: number
  longitude: number
}

export interface RouteMapProps {
  /** Main route, as the API sends it: `[latitude, longitude]` pairs. */
  route: [number, number][] | null | undefined
  /** Standard/baseline route used for comparison. */
  comparison?: [number, number][] | null
  /** Optional emergency-operational route, drawn as a third distinct path. */
  critical?: [number, number][] | null
  originLabel?: string
  destinationLabel?: string
  /** Tailwind height/width for the frame; the map fills it absolutely. */
  className?: string
  emptyMessage?: string
  /**
   * Extent of the street network. Drawn as an outline so it is obvious where a
   * point may be dropped — the graph stops at the city, and a rejection after
   * the fact is a worse way to learn that.
   */
  coverage?: GraphBounds | null
  /** When given, the map is interactive even with no route and reports clicks. */
  onPick?: (latitude: number, longitude: number) => void
  /** A standalone pin, e.g. the destination chosen before any route exists. */
  pin?: { latitude: number, longitude: number, label?: string } | null
  /**
   * Stations to plot whether or not there is a route.
   *
   * Seeing every station at once is the point: which one is closest to an
   * address is a question the map answers instantly and a list of coordinates
   * never does.
   */
  stations?: MapStation[]
  /** Drawn in the accent, like the route that leaves from it. */
  selectedStationId?: string | null
  /** Drawn in teal, as the suggestion it is. */
  nearestStationId?: string | null
  /** When given, station pins are clickable. */
  onStationSelect?: (id: string) => void
  /**
   * Whether the page has widened the map. Passing `onTheaterToggle` is what
   * puts the button on the map at all — a map with nowhere to expand to, like
   * the one inside a modal, simply does not offer it.
   */
  theater?: boolean
  onTheaterToggle?: () => void
  /** Increment to replay the primary route from its beginning. */
  simulationRequest?: number
  /** Increment to compare all available route variants on one clock. */
  comparisonSimulationRequest?: number
  /** Real estimated times; only their ratio is preserved in the compressed comparison playback. */
  comparisonSimulationTimes?: { primarySeconds: number, comparisonSeconds: number, criticalSeconds?: number }
  /**
   * Edges of the primary route with their predicted speed. When given, the
   * route is painted by how freely the network expects traffic to flow.
   */
  speedSegments?: RouteSegment[] | null
  /** Circles the dispatcher marked as blocked. */
  closures?: Closure[]
  /** Change `key` to fly the camera to the point (e.g. a manoeuvre picked from the list). */
  focus?: { latitude: number, longitude: number, key: number } | null
  /** Where the vehicle is now (GPS or simulation), drawn as its own marker. */
  livePosition?: { latitude: number, longitude: number, label: string } | null
}

/**
 * Runs a camera animation and calls `done` once it settles.
 *
 * The obvious `map.flyTo(...); map.once("moveend", done)` silently fails on a
 * machine with system animations turned off: the browser reports
 * `prefers-reduced-motion`, MapLibre skips the animation, and `moveend` fires
 * synchronously *inside* `flyTo` — before the listener on the next line
 * exists. The orbit and the route playback then never start until some later,
 * unrelated movement happens to trigger the orphaned listener.
 *
 * So the listener goes first, `essential: true` tells MapLibre the movement
 * carries meaning and must play anyway, and `map.stop()` flushes the `moveend`
 * of any animation already in flight before the listener can catch it.
 */
function cameraThen(
  map: maplibregl.Map,
  durationMs: number,
  move: () => void,
  done: () => void,
): () => void {
  map.stop()

  let settled = false

  const settle = () => {
    if (settled) return
    settled = true
    map.off("moveend", settle)
    window.clearTimeout(timer)
    done()
  }

  // An interrupted movement may never emit its own `moveend`, so the duration
  // doubles as a deadline.
  const timer = window.setTimeout(settle, durationMs + 400)

  map.on("moveend", settle)
  move()

  return () => {
    settled = true
    map.off("moveend", settle)
    window.clearTimeout(timer)
  }
}

function dampBearing(current: number, target: number, deltaMs: number, responseMs: number): number {
  const delta = ((target - current + 540) % 360) - 180
  const amount = 1 - Math.exp(-Math.max(0, deltaMs) / responseMs)
  return current + delta * amount
}

export default function RouteMap({
  route,
  comparison,
  critical,
  originLabel = "Origem",
  destinationLabel = "Destino",
  className,
  emptyMessage = "Nenhuma rota para exibir",
  coverage,
  onPick,
  pin,
  stations,
  selectedStationId,
  nearestStationId,
  onStationSelect,
  theater,
  onTheaterToggle,
  simulationRequest = 0,
  comparisonSimulationRequest = 0,
  comparisonSimulationTimes,
  speedSegments,
  closures,
  focus,
  livePosition,
}: RouteMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const followTriggerRef = useRef<HTMLButtonElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const originMarker = useRef<maplibregl.Marker | null>(null)
  const destinationMarker = useRef<maplibregl.Marker | null>(null)
  const pinMarker = useRef<maplibregl.Marker | null>(null)
  const liveMarker = useRef<maplibregl.Marker | null>(null)
  const stationMarkers = useRef(new Map<string, maplibregl.Marker>())

  const cancelOrbit = useRef<(() => void) | null>(null)

  const cancelFollow = useRef<(() => void) | null>(null)
  const followRAF = useRef<number | null>(null)
  const followStart = useRef<number | null>(null)
  const followBearing = useRef<number | null>(null)
  const followCameraBearing = useRef<number | null>(null)
  const followFrameTime = useRef<number | null>(null)
  const followElapsed = useRef(0)
  const followPausedRef = useRef(false)
  const pauseFollow = useRef<((paused: boolean) => void) | null>(null)
  const followProgressRef = useRef<HTMLProgressElement>(null)
  const followDistanceRef = useRef<HTMLSpanElement>(null)

  const cancelComparison = useRef<(() => void) | null>(null)

  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d")
  const [camMode, setCamMode] = useState<CamMode>("free")
  const [playback, setPlayback] = useState<"idle" | "follow" | "comparison">("idle")
  const [followPaused, setFollowPaused] = useState(false)
  const [loadingSlow, setLoadingSlow] = useState(false)
  const [showComparison, setShowComparison] = useState(true)
  const [view, setView] = useState<MapView>("inline")

  /**
   * Whether the style has finished loading and the layers exist.
   *
   * This is state and not a ref on purpose. As a ref it never re-rendered, so
   * anything that arrived while the style was still downloading — the coverage
   * rectangle, the stations, a route fetched faster than the basemap — found
   * the map "not ready", returned early, and was never drawn: nothing ever ran
   * those effects again. As state, `load` re-runs every one of them.
   */
  const [ready, setReady] = useState(false)

  const coords = useMemo(() => toMapCoords(route), [route])
  const comparisonCoords = useMemo(() => toMapCoords(comparison), [comparison])
  const criticalCoords = useMemo(() => toMapCoords(critical), [critical])
  const metrics = useMemo(() => measureRoute(coords), [coords])
  const comparisonMetrics = useMemo(() => measureRoute(comparisonCoords), [comparisonCoords])

  // The map is built once and then fed; the animations read the current route
  // through refs so they never close over stale geometry.
  const metricsRef = useRef<RouteMetrics>(metrics)
  useEffect(() => { metricsRef.current = metrics }, [metrics])
  const comparisonMetricsRef = useRef<RouteMetrics>(comparisonMetrics)

  useEffect(() => {
    comparisonMetricsRef.current = comparisonMetrics
  }, [comparisonMetrics])

  // Clicks are handed to the latest callback without rebuilding the map.
  const pickRef = useRef(onPick)
  useEffect(() => { pickRef.current = onPick }, [onPick])

  // Read by the `load` handler, which runs long after the effect that built the
  // map captured its props.
  const coverageRef = useRef(coverage)
  useEffect(() => { coverageRef.current = coverage }, [coverage])

  const stationsRef = useRef(stations)
  useEffect(() => { stationsRef.current = stations }, [stations])

  const selectStationRef = useRef(onStationSelect)
  useEffect(() => { selectStationRef.current = onStationSelect }, [onStationSelect])

  const hasRoute = coords.length > 1
  const interactive = Boolean(onPick)
  const hasStations = (stations?.length ?? 0) > 0

  // A picking map, or one with stations to show, has to exist before there is
  // anything else to draw on it; a read-only one with nothing on it is not
  // worth a style download until there is a route.
  const showMap = hasRoute || interactive || hasStations

  // -- Camera control --------------------------------------------------------

  const enableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.enable()
    map.scrollZoom.enable()
    map.dragRotate.enable()
    map.keyboard.enable()
    map.touchZoomRotate.enable()
  }

  const disableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.disable()
    map.scrollZoom.disable()
    map.dragRotate.disable()
    map.keyboard.disable()
    map.touchZoomRotate.disable()
  }

  const stopOrbit = () => {
    cancelOrbit.current?.()
    cancelOrbit.current = null

  }

  const syncMarkers = (map: maplibregl.Map, at: LngLat[]) => {
    if (at.length === 0) {
      originMarker.current?.remove()
      destinationMarker.current?.remove()
      originMarker.current = null
      destinationMarker.current = null
      return
    }

    if (!originMarker.current) {
      originMarker.current = createMarker(map, at[0], "#0B63A5", "B", originLabel)
    }
    if (!destinationMarker.current) {
      destinationMarker.current = createMarker(
        map, at[at.length - 1], "#A32A20", "!", destinationLabel,
      )
    }

    originMarker.current.setLngLat(at[0])
    destinationMarker.current.setLngLat(at[at.length - 1])
  }

  const fitDisplayedRoutes = (
    map: maplibregl.Map,
    primary: LngLat[],
    secondary: LngLat[] = [],
    criticalRoute: LngLat[] = [],
  ) => {
    const visible = [
      ...primary,
      ...(showComparison ? secondary : []),
      ...criticalRoute,
    ]
    if (visible.length === 0) return

    const bounds = new maplibregl.LngLatBounds()
    visible.forEach((point) => bounds.extend(point))

    map.fitBounds(bounds, {
      padding: { top: 54, right: 54, bottom: 54, left: 54 },
      maxZoom: 15.5,
      duration: 650,
      essential: false,
    })
  }

  const stopFollow = () => {
    if (document.activeElement && wrapRef.current?.querySelector(".follow-hud")?.contains(document.activeElement)) followTriggerRef.current?.focus()
    cancelFollow.current?.()
    cancelFollow.current = null
    pauseFollow.current = null
    mapRef.current?.stop()

    if (followRAF.current !== null) {
      cancelAnimationFrame(followRAF.current)
      followRAF.current = null
    }
    followStart.current = null
    followBearing.current = null
    followCameraBearing.current = null
    followFrameTime.current = null
    followElapsed.current = 0
    followPausedRef.current = false
    setFollowPaused(false)
    setPlayback((current) => current === "follow" ? "idle" : current)
  }

  const stopComparisonSimulation = () => {
    cancelComparison.current?.()
    cancelComparison.current = null
    setPlayback((current) => current === "comparison" ? "idle" : current)
  }

  // -- Map lifecycle ---------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !showMap) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: metricsRef.current.coords.length > 0 ? metricsRef.current.center : FALLBACK_CENTER,
      zoom: 13.5,
      pitch: 0,
      bearing: 0,
      canvasContextAttributes: { antialias: true },
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    })

    mapRef.current = map
    const releaseToolbar = observeMapToolbar(wrapRef.current!, toolbarRef.current!, map)
    const loadingTimer = window.setTimeout(() => setLoadingSlow(true), 15_000)
    map.getCanvas().setAttribute("aria-label", "Mapa de rotas. Use as setas para mover e mais ou menos para ajustar o zoom.")
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left")

    // Captured now: reading `stationMarkers.current` inside the cleanup would
    // read whatever it holds at teardown, not the collection this map filled.
    const markers = stationMarkers.current

    map.on("load", () => {
      window.clearTimeout(loadingTimer)
      setLoadingSlow(false)
      const live = metricsRef.current

      addCoverageLayer(map, coverageRef.current)
      addRouteLayers(map, live.coords, comparisonCoords, criticalCoords)
      addArrowLayer(map, live.coords[0] ?? FALLBACK_CENTER)

      map.setMaxPitch(0)
      map.setMinZoom(9)
      map.setMaxZoom(16)

      set3DEnvironment(map, false)
      setBuildingLayersVisibility(map, false)
      syncMarkers(map, live.coords)

      if (live.coords.length > 0) {
        fitDisplayedRoutes(map, live.coords, comparisonCoords, criticalCoords)
      } else if (coverageRef.current) {
        fitBoundsOf(map, coverageRef.current)
      }

      setReady(true)
    })

    if (interactive) {
      map.getCanvas().style.cursor = "crosshair"
      map.on("click", (event) => {
        pickRef.current?.(event.lngLat.lat, event.lngLat.lng)
      })
    }

    return () => {
      window.clearTimeout(loadingTimer)
      releaseToolbar()
      stopOrbit()
      stopFollow()
      stopComparisonSimulation()
      setReady(false)
      originMarker.current = null
      destinationMarker.current = null
      pinMarker.current = null
      liveMarker.current = null
      markers.clear()
      map.remove()
      mapRef.current = null
    }
    // The map is intentionally built once; route changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap])

  // A new route replaces the geometry in place rather than rebuilding the map,
  // which would cost a full style download on every incident selected.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    stopFollow()
    stopComparisonSimulation()
    showArrow(map, false)
    showComparisonVehicle(map, false)
    setCamMode("free")
    enableFreeCamera(map)

    updateRouteData(map, coords, comparisonCoords, criticalCoords)
    syncMarkers(map, coords)

    if (coords.length > 0) fitDisplayedRoutes(map, coords, comparisonCoords, criticalCoords)
    // Labels are captured on creation; a route change is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, comparisonCoords, criticalCoords, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setComparisonVisibility(map, showComparison && comparisonCoords.length > 1)
  }, [showComparison, comparisonCoords, ready, mapMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    updateCoverageData(map, coverage)
  }, [coverage, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setSpeedOverlay(map, speedSegments ? route : null, speedSegments)
  }, [route, speedSegments, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setClosures(map, closures)
  }, [closures, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!livePosition) {
      liveMarker.current?.remove()
      liveMarker.current = null
      return
    }
    const at: LngLat = [livePosition.longitude, livePosition.latitude]
    if (!liveMarker.current) {
      liveMarker.current = createMarker(map, at, "#0E6E75", "▲", livePosition.label)
    } else {
      liveMarker.current.setLngLat(at)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePosition?.latitude, livePosition?.longitude, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !focus) return
    map.flyTo({ center: [focus.longitude, focus.latitude], zoom: Math.max(map.getZoom(), 16), duration: 700, essential: true })
    // Only a new key means a new request; the coordinates alone may repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, ready])

  // The picked point gets its own pin so the click has visible feedback before
  // any route is calculated.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    if (!pin) {
      pinMarker.current?.remove()
      pinMarker.current = null
      return
    }

    const at: LngLat = [pin.longitude, pin.latitude]

    if (!pinMarker.current) {
      pinMarker.current = createMarker(map, at, "#A32A20", "!", pin.label ?? "Destino")
    } else {
      pinMarker.current.setLngLat(at)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.latitude, pin?.longitude, pin?.label, ready])

  /**
   * Station pins, rebuilt whenever the list or the highlight changes.
   *
   * The signature is what the effect actually watches: a caller that rebuilds
   * its station array on every render would otherwise re-add every marker on
   * every keystroke, and making each screen memoise correctly is a rule nobody
   * remembers. The array itself is read through a ref.
   */
  const stationSignature = (stations ?? [])
    .map((station) => `${station.id}:${station.latitude}:${station.longitude}:${station.acronym}`)
    .join("|")

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const markers = stationMarkers.current

    for (const station of stationsRef.current ?? []) {
      const marker = createStationMarker(
        map,
        [station.longitude, station.latitude],
        station,
        {
          selected: station.id === selectedStationId,
          nearest: station.id !== selectedStationId && station.id === nearestStationId,
          onClick: selectStationRef.current
            ? () => selectStationRef.current?.(station.id)
            : undefined,
        },
      )

      markers.set(station.id, marker)
    }

    return () => {
      markers.forEach((marker) => marker.remove())
      markers.clear()
    }
  }, [stationSignature, selectedStationId, nearestStationId, ready])

  // -- Size ------------------------------------------------------------------

  /**
   * MapLibre measures its container once and never looks again, so every way
   * the box can change size has to tell it: theater, fullscreen, the browser
   * window, and the responsive grid collapsing a column underneath it.
   */
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !showMap) return

    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [showMap])

  // Leaving fullscreen with Escape or the browser's own control never goes
  // through our button, so the state is read back from the document.
  useEffect(() => {
    const onChange = () => {
      const wrap = wrapRef.current
      if (document.fullscreenElement !== wrap) {
        setView((current) => (current === "full" ? "inline" : current))
      }
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // Theater belongs to the page, but its Escape is still expected to work.
  useEffect(() => {
    if (!theater || !onTheaterToggle) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onTheaterToggle()
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [theater, onTheaterToggle])

  const toggleFullscreen = () => {
    const wrap = wrapRef.current
    if (!wrap) return

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
      return
    }

    // Fullscreen can be refused — an iframe without the permission, a browser
    // that never implemented it. Widening the map in the page is the
    // consolation prize, and it is close enough that the click still does
    // something like what it looked like it would.
    wrap.requestFullscreen()
      .then(() => setView("full"))
      .catch(() => onTheaterToggle?.())
  }

  // -- 3D overview -----------------------------------------------------------

  const startOrbit = (map: maplibregl.Map) => {
    stopOrbit()
    setCamMode("free")
    enableFreeCamera(map)
    map.easeTo({ pitch: 52, bearing: -18, duration: 650 })
  }

  // -- Route playback --------------------------------------------------------

  const startFollow = (map: maplibregl.Map) => {
    stopFollow()
    stopComparisonSimulation()

    const live = metricsRef.current
    if (live.coords.length < 2) return

    setPlayback("follow")
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reducedMotion = motionPreference.matches
    followPausedRef.current = reducedMotion
    setFollowPaused(reducedMotion)

    disableFreeCamera(map)
    followStart.current = null

    // The layer may not exist yet if the icon was still decoding when the map
    // loaded, and the 2D/3D toggle hides it — so it is re-asserted here.
    addArrowLayer(map, live.coords[0])
    showArrow(map, true)

    const initialBearing = bearingBetween(live.coords[0], live.coords[1])
    moveArrow(map, live.coords[0], initialBearing)
    followBearing.current = initialBearing
    followCameraBearing.current = initialBearing
    followFrameTime.current = null

    let cancelled = false
    let frame: FrameRequestCallback | null = null
    const cancelFrame = () => {
      if (followRAF.current !== null) cancelAnimationFrame(followRAF.current)
      followRAF.current = null
      followFrameTime.current = null
    }
    const scheduleFrame = () => {
      if (!cancelled && frame && !followPausedRef.current && !document.hidden && followRAF.current === null) {
        followRAF.current = requestAnimationFrame(frame)
      }
    }
    pauseFollow.current = (paused) => {
      followPausedRef.current = paused
      setFollowPaused(paused)
      if (paused) {
        cancelFrame()
        map.stop()
      } else {
        scheduleFrame()
      }
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelFrame()
        map.stop()
      } else {
        scheduleFrame()
      }
    }
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      if (!reducedMotion) return
      pauseFollow.current?.(true)
      map.jumpTo({ pitch: 0, bearing: 0 })
      fitDisplayedRoutes(map, live.coords)
    }
    motionPreference.addEventListener("change", onMotionChange)
    document.addEventListener("visibilitychange", onVisibilityChange)
    const cancelCamera = cameraThen(
      map,
      1200,
      () => map.flyTo({
        center: live.coords[0],
        zoom: reducedMotion ? map.getZoom() : WAZE_ZOOM,
        pitch: reducedMotion ? 0 : WAZE_PITCH,
        bearing: reducedMotion ? 0 : initialBearing,
        duration: reducedMotion ? 0 : 1200,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      }),
      () => {
        if (reducedMotion) fitDisplayedRoutes(map, live.coords)
        followStart.current = null
        showArrow(map, true)
        let lastReadout = -Infinity

        frame = (timestamp: number) => {
          followRAF.current = null
          if (cancelled || followPausedRef.current || document.hidden) {
            followFrameTime.current = null
            return
          }
          const { totalMeters, followDurationMs, pointAtDist } = metricsRef.current
          const deltaMs = followFrameTime.current === null ? 0 : Math.min(100, Math.max(0, timestamp - followFrameTime.current))
          followFrameTime.current = timestamp
          followElapsed.current += deltaMs
          const travelled = Math.min(totalMeters, (followElapsed.current / followDurationMs) * totalMeters)
          if (timestamp - lastReadout > 180) {
            lastReadout = timestamp
            if (followProgressRef.current) followProgressRef.current.value = totalMeters > 0 ? travelled / totalMeters : 1
            if (followDistanceRef.current) followDistanceRef.current.textContent = `${formatDistance(Math.max(0, totalMeters - travelled))} até o destino`
          }

          if (travelled >= totalMeters) {
            stopFollow()
            enableFreeCamera(map)
            setCamMode("free")
            showArrow(map, false)
            return
          }

          const position = pointAtDist(travelled)

          // Estimate the road tangent across the corner instead of looking at
          // only one forward segment. This lets the truck begin rotating before
          // the vertex and finish the turn after it, avoiding the rigid snap.
          const behind = pointAtDist(Math.max(0, travelled - 16))
          const ahead = pointAtDist(Math.min(travelled + 30, totalMeters))
          const targetBearing = bearingBetween(behind, ahead)

          const bearing = dampBearing(
            followBearing.current ?? targetBearing,
            targetBearing,
            deltaMs,
            145,
          )
          followBearing.current = bearing

          // The camera follows the same curve with a slower response, so the
          // truck turns visibly inside a stable navigation view instead of the
          // whole scene snapping together.
          const cameraTarget = bearingBetween(
            pointAtDist(Math.max(0, travelled - 8)),
            pointAtDist(Math.min(travelled + 42, totalMeters)),
          )
          const cameraBearing = dampBearing(
            followCameraBearing.current ?? cameraTarget,
            cameraTarget,
            deltaMs,
            260,
          )
          followCameraBearing.current = cameraBearing

          // Centering slightly ahead keeps the vehicle below centre and leaves
          // more road visible in the direction of travel, like a navigation HUD.
          const cameraCenter = pointAtDist(Math.min(travelled + 18, totalMeters))

          moveArrow(map, position, bearing)
          if (!reducedMotion) map.jumpTo({
            center: cameraCenter,
            bearing: cameraBearing,
            pitch: WAZE_PITCH,
            zoom: WAZE_ZOOM,
          })

          scheduleFrame()
        }

        scheduleFrame()
      },
    )
    cancelFollow.current = () => {
      cancelled = true
      cancelFrame()
      cancelCamera()
      motionPreference.removeEventListener("change", onMotionChange)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }

  const startComparisonSimulation = (map: maplibregl.Map) => {
    stopFollow()
    stopComparisonSimulation()
    const primary = metricsRef.current
    const secondary = comparisonMetricsRef.current
    const emergency = measureRoute(criticalCoords)
    if (primary.coords.length < 2 || secondary.coords.length < 2 || !wrapRef.current) return
    setMapMode("3d")
    setCamMode("follow")
    setPlayback("comparison")
    setShowComparison(true)
    setLayerVisibility(map, true)
    set3DEnvironment(map, true)
    setBuildingLayersVisibility(map, true)
    map.setMaxPitch(70)
    map.setMaxZoom(20)
    disableFreeCamera(map)
    showArrow(map, false)
    const participants = [
      { metrics: primary, seconds: comparisonSimulationTimes?.primarySeconds ?? primary.totalMeters, kind: "ai" as const },
      { metrics: secondary, seconds: comparisonSimulationTimes?.comparisonSeconds ?? secondary.totalMeters, kind: "standard" as const },
      ...(emergency.coords.length > 1 ? [{ metrics: emergency, seconds: comparisonSimulationTimes?.criticalSeconds ?? emergency.totalMeters, kind: "critical" as const }] : []),
    ]
    cancelComparison.current = startComparisonPlayback(map, wrapRef.current, participants, () => {
      setCamMode("free")
      setPlayback("idle")
      enableFreeCamera(map)
    })
  }

  const handleCamModeChange = (next: CamMode) => {
    const map = mapRef.current
    if (!map) return

    if (next === camMode) return

    setCamMode(next)

    if (next === "free") {
      stopFollow()
      stopComparisonSimulation()
      showArrow(map, false)
      showComparisonVehicle(map, false)
      enableFreeCamera(map)
    } else {
      stopComparisonSimulation()
      setMapMode("3d")
      setLayerVisibility(map, true)
      set3DEnvironment(map, true)
      setBuildingLayersVisibility(map, true)
      map.setMaxPitch(70)
      map.setMaxZoom(20)
      showComparisonVehicle(map, false)
      setCamMode("follow")
      startFollow(map)
    }
  }

  const handleToggle = () => {
    const map = mapRef.current
    if (!map) return

    if (mapMode === "2d") {
      setMapMode("3d")
      setCamMode("free")

      setLayerVisibility(map, true)
      set3DEnvironment(map, true)

      map.setMaxPitch(85)
      map.setMinZoom(9)
      map.setMaxZoom(20)

      setBuildingLayersVisibility(map, true)
      startOrbit(map)
    } else {
      setMapMode("2d")
      setCamMode("free")

      stopOrbit()
      stopFollow()
      stopComparisonSimulation()
      showArrow(map, false)
      showComparisonVehicle(map, false)

      setLayerVisibility(map, false)
      set3DEnvironment(map, false)

      map.setMaxPitch(0)
      map.setMaxZoom(16)

      setBuildingLayersVisibility(map, false)
      enableFreeCamera(map)

      cancelOrbit.current = cameraThen(
        map,
        800,
        () => map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 800,
          essential: false,
          easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
        }),
        () => {
          const live = metricsRef.current
          if (live.coords.length > 0) fitDisplayedRoutes(map, live.coords, comparisonCoords, criticalCoords)
          else if (coverageRef.current) fitBoundsOf(map, coverageRef.current)
        },
      )
    }
  }

  useEffect(() => {
    if (!ready || simulationRequest <= 0) return

    const map = mapRef.current
    if (!map || metricsRef.current.coords.length < 2) return

    stopOrbit()
    stopComparisonSimulation()
    setMapMode("3d")
    setCamMode("follow")
    setLayerVisibility(map, true)
    set3DEnvironment(map, true)
    setBuildingLayersVisibility(map, true)
    map.setMaxPitch(85)
    map.setMinZoom(9)
    map.setMaxZoom(20)
    startFollow(map)
    // Triggered intentionally only by the replay signal and readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationRequest, ready])

  useEffect(() => {
    if (!ready || comparisonSimulationRequest <= 0) return

    const map = mapRef.current
    if (!map) return

    stopOrbit()
    startComparisonSimulation(map)
    // Triggered intentionally only by the comparison signal and readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonSimulationRequest, ready])

  if (!showMap) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 border bg-surface", className)}>
        <MapPinOff className="h-12 w-12 text-ink-soft" />
        <p className="text-ink-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={cn("map-wrap border", playback !== "idle" && "map-playing", className)} onKeyDown={(event) => { if (event.key === "Escape" && playback === "follow") { event.preventDefault(); handleCamModeChange("free") } }}>
      <div ref={containerRef} className="map" />
      <div ref={toolbarRef} className="top-controls">
        <div className="map-toolbar-title"><span>MAPA OPERACIONAL</span><strong>{playback === "comparison" ? "Comparação de percursos" : playback === "follow" ? "Acompanhamento da rota" : "Visão do território"}</strong></div>
        <div className="map-toolbar-actions">
          <div className="toggle-wrap" role="group" aria-label="Dimensão do mapa">
            <button type="button" disabled={!ready} aria-pressed={mapMode === "2d"} className={mapMode === "2d" ? "active" : ""} onClick={() => mapMode !== "2d" && handleToggle()}><MapIcon size={14} />2D</button>
            <button type="button" disabled={!ready} aria-pressed={mapMode === "3d"} className={mapMode === "3d" ? "active" : ""} onClick={() => mapMode !== "3d" && handleToggle()}><Box size={14} />3D</button>
          </div>
          {comparisonCoords.length > 1 && (
            <div className="toggle-wrap">
              <button type="button" disabled={!ready || playback === "comparison"} aria-pressed={showComparison} className={cn("compare", showComparison && "active")} onClick={() => setShowComparison((value) => !value)} title="Mostrar ou ocultar o traçado da rota padrão"><span className="compare-swatch" />Padrão</button>
            </div>
          )}
          {hasRoute && (
            <div className="toggle-wrap">
              <button ref={followTriggerRef} type="button" disabled={!ready || playback === "comparison"} aria-pressed={playback === "follow"} className={playback === "follow" ? "active" : ""} onClick={() => handleCamModeChange(playback === "follow" ? "free" : "follow")}>
                {playback === "follow" ? <Globe size={14} /> : <Navigation size={14} />}{playback === "follow" ? "Câmera livre" : "Seguir rota"}
              </button>
            </div>
          )}
          <div className="toggle-wrap map-view-controls" role="group" aria-label="Enquadramento do mapa">
            <button type="button" disabled={!ready || playback !== "idle"} className="view" aria-label="Enquadrar rotas e unidades" title="Enquadrar rotas e unidades" onClick={() => {
              const map = mapRef.current
              if (!map) return
              if (coords.length) fitDisplayedRoutes(map, coords, comparisonCoords, criticalCoords)
              else if (coverage) fitBoundsOf(map, coverage)
              else if (stations?.length) {
                const bounds = new maplibregl.LngLatBounds()
                stations.forEach((station) => bounds.extend([station.longitude, station.latitude]))
                map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 500 })
              }
            }}><LocateFixed size={15} /></button>
            {onTheaterToggle && <button type="button" className={cn("view", theater && "active")} aria-label={theater ? "Recolher mapa" : "Expandir mapa na página"} aria-pressed={Boolean(theater)} onClick={onTheaterToggle} title="Expandir mapa na página">{theater ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
            <button type="button" className={cn("view", view === "full" && "active")} aria-label={view === "full" ? "Sair da tela cheia" : "Abrir em tela cheia"} aria-pressed={view === "full"} onClick={toggleFullscreen} title={view === "full" ? "Sair da tela cheia" : "Abrir em tela cheia"}>{view === "full" ? <Minimize size={15} /> : <Maximize size={15} />}</button>
          </div>
        </div>
      </div>
      {!ready && <div className="map-loading" role="status"><MapIcon size={25} /><strong>{loadingSlow ? "A cartografia está demorando a responder" : "Carregando cartografia"}</strong><span>{loadingSlow ? "Verifique a conexão com o serviço de mapas." : "Preparando vias e referências do território…"}</span></div>}
      {ready && playback === "idle" && hasRoute && (
        <div className="map-route-caption"><Navigation size={15} /><div><strong>{originLabel} <span aria-hidden="true">→</span> {destinationLabel}</strong><span>{formatDistance(metrics.totalMeters)} de traçado · {mapMode === "3d" ? "Perspectiva 3D" : "Vista superior"}</span></div></div>
      )}
      {playback === "follow" && (
        <div className="follow-hud">
          <div className="follow-heading"><div><span className="map-kicker">REPRODUÇÃO DO PERCURSO</span><strong>{followPaused ? "Reprodução pausada" : "Seguindo a rota"}</strong></div><div className="follow-actions">
            <button type="button" aria-pressed={followPaused} onClick={() => pauseFollow.current?.(!followPausedRef.current)}>{followPaused ? <Play size={14} /> : <Pause size={14} />}{followPaused ? "Continuar" : "Pausar"}</button>
            <button type="button" onClick={() => handleCamModeChange("free")}><Square size={12} />Encerrar</button>
          </div></div>
          <div className="follow-readout"><span ref={followDistanceRef}>{formatDistance(metrics.totalMeters)} até o destino</span><span>Posição simulada</span></div>
          <progress ref={followProgressRef} max={1} value={0} aria-label="Progresso do percurso" />
        </div>
      )}
      {ready && interactive && !hasRoute && <p className="map-hint"><Navigation size={14} />{pin ? "Destino marcado · calcule a rota para continuar" : "Selecione uma unidade e marque o destino no mapa"}</p>}
    </div>
  )
}

export type { LngLat }
