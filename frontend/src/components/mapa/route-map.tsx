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
import {
  Box, ChevronDown, Globe, Map as MapIcon, MapPinOff, Maximize, Maximize2, Minimize,
  Minimize2, Navigation,
} from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import type { GraphBounds } from "@/api/types"
import type { CamMode } from "./types/types"
import { ORBIT_PERIOD, STYLE, WAZE_PITCH, WAZE_ZOOM } from "./constants/constants"
import { bearingBetween, measureRoute, toMapCoords } from "./routes/utils"
import type { LngLat, RouteMetrics } from "./routes/utils"
import { addArrowLayer, createMarker, createStationMarker, moveArrow, showArrow } from "./map/markers"
import {
  addCoverageLayer, addRouteLayers, setBuildingLayersVisibility, setComparisonVisibility,
  setLayerVisibility, updateCoverageData, updateRouteData,
} from "./map/layers"
import { fitBoundsOf, fitRoute } from "./map/helpers"
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
  /** Optional second route drawn dimmed underneath, for the comparison. */
  comparison?: [number, number][] | null
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

export default function RouteMap({
  route,
  comparison,
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
}: RouteMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const originMarker = useRef<maplibregl.Marker | null>(null)
  const destinationMarker = useRef<maplibregl.Marker | null>(null)
  const pinMarker = useRef<maplibregl.Marker | null>(null)
  const stationMarkers = useRef(new Map<string, maplibregl.Marker>())

  const cancelOrbit = useRef<(() => void) | null>(null)
  const orbitRAF = useRef<number | null>(null)
  const orbitStart = useRef<number | null>(null)

  const cancelFollow = useRef<(() => void) | null>(null)
  const followRAF = useRef<number | null>(null)
  const followStart = useRef<number | null>(null)

  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d")
  const [orbitDone, setOrbitDone] = useState(false)
  const [camMode, setCamMode] = useState<CamMode>("free")
  const [dropOpen, setDropOpen] = useState(false)
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
  const metrics = useMemo(() => measureRoute(coords), [coords])

  // The map is built once and then fed; the animations read the current route
  // through this ref so they never close over a stale one.
  const metricsRef = useRef<RouteMetrics>(metrics)
  metricsRef.current = metrics

  // Clicks are handed to the latest callback without rebuilding the map.
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  // Read by the `load` handler, which runs long after the effect that built the
  // map captured its props.
  const coverageRef = useRef(coverage)
  coverageRef.current = coverage

  const stationsRef = useRef(stations)
  stationsRef.current = stations

  const selectStationRef = useRef(onStationSelect)
  selectStationRef.current = onStationSelect

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
    map.touchZoomRotate.enable()
  }

  const disableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.disable()
    map.scrollZoom.disable()
    map.dragRotate.disable()
    map.touchZoomRotate.disable()
  }

  const stopOrbit = () => {
    cancelOrbit.current?.()
    cancelOrbit.current = null

    if (orbitRAF.current !== null) {
      cancelAnimationFrame(orbitRAF.current)
      orbitRAF.current = null
    }
    orbitStart.current = null
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

  const stopFollow = () => {
    cancelFollow.current?.()
    cancelFollow.current = null

    if (followRAF.current !== null) {
      cancelAnimationFrame(followRAF.current)
      followRAF.current = null
    }
    followStart.current = null
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
    })

    mapRef.current = map

    // Captured now: reading `stationMarkers.current` inside the cleanup would
    // read whatever it holds at teardown, not the collection this map filled.
    const markers = stationMarkers.current

    map.on("load", () => {
      const live = metricsRef.current

      addCoverageLayer(map, coverageRef.current)
      addRouteLayers(map, live.coords, comparisonCoords)
      addArrowLayer(map, live.coords[0] ?? FALLBACK_CENTER)

      map.setMaxPitch(0)
      map.setMinZoom(9)
      map.setMaxZoom(16)

      setBuildingLayersVisibility(map, false)
      syncMarkers(map, live.coords)

      if (live.coords.length > 0) fitRoute(map, live.coords)
      else if (coverageRef.current) fitBoundsOf(map, coverageRef.current)

      setReady(true)
    })

    if (interactive) {
      map.getCanvas().style.cursor = "crosshair"
      map.on("click", (event) => {
        pickRef.current?.(event.lngLat.lat, event.lngLat.lng)
      })
    }

    return () => {
      stopOrbit()
      stopFollow()
      setReady(false)
      originMarker.current = null
      destinationMarker.current = null
      pinMarker.current = null
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
    showArrow(map, false)
    setCamMode("free")
    enableFreeCamera(map)

    updateRouteData(map, coords, comparisonCoords)
    syncMarkers(map, coords)

    if (coords.length > 0) fitRoute(map, coords)
    // Labels are captured on creation; a route change is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, comparisonCoords, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setComparisonVisibility(map, showComparison && comparisonCoords.length > 1)
  }, [showComparison, comparisonCoords, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    updateCoverageData(map, coverage)
  }, [coverage, ready])

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

  // -- Orbit intro -----------------------------------------------------------

  const startOrbit = (map: maplibregl.Map) => {
    stopOrbit()

    setOrbitDone(false)
    orbitStart.current = null

    disableFreeCamera(map)

    const live = metricsRef.current
    const center = live.coords.length > 0 ? live.center : map.getCenter().toArray() as LngLat
    const targetZoom = live.coords.length > 0
      ? Math.max(12, Math.min(15.5, 15.3 - live.radius * 60))
      : map.getZoom()

    cancelOrbit.current = cameraThen(
      map,
      1400,
      () => map.flyTo({
        center,
        zoom: targetZoom,
        pitch: 60,
        bearing: 0,
        duration: 1400,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      }),
      () => {
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
      },
    )
  }

  // -- Route playback --------------------------------------------------------

  const startFollow = (map: maplibregl.Map) => {
    stopFollow()

    const live = metricsRef.current
    if (live.coords.length < 2) return

    disableFreeCamera(map)
    followStart.current = null

    // The layer may not exist yet if the icon was still decoding when the map
    // loaded, and the 2D/3D toggle hides it — so it is re-asserted here.
    addArrowLayer(map, live.coords[0])
    showArrow(map, true)

    const initialBearing = bearingBetween(live.coords[0], live.coords[1])

    cancelFollow.current = cameraThen(
      map,
      1200,
      () => map.flyTo({
        center: live.coords[0],
        zoom: WAZE_ZOOM,
        pitch: WAZE_PITCH,
        bearing: initialBearing,
        duration: 1200,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      }),
      () => {
        followStart.current = null
        showArrow(map, true)

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
      },
    )
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
      map.setMinZoom(9)
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

      cameraThen(
        map,
        800,
        () => map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 800,
          essential: true,
          easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
        }),
        () => {
          const live = metricsRef.current
          if (live.coords.length > 0) fitRoute(map, live.coords)
          else if (coverageRef.current) fitBoundsOf(map, coverageRef.current)
        },
      )
    }
  }

  const CAM_OPTIONS: { value: CamMode, label: string, Icon: React.ElementType }[] = [
    { value: "free", label: "Livre", Icon: Globe },
    { value: "follow", label: "Seguir Rota", Icon: Navigation },
  ]

  const currentCam = CAM_OPTIONS.find((option) => option.value === camMode) ?? CAM_OPTIONS[0]
  const CurrentCamIcon = currentCam.Icon

  if (!showMap) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 border bg-surface", className)}>
        <MapPinOff className="h-12 w-12 text-ink-soft" />
        <p className="text-ink-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={cn("map-wrap border", className)}>
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
              className={cn("compare", showComparison && "active")}
              onClick={() => setShowComparison((value) => !value)}
              title={showComparison
                ? "A rota mais curta em metros está visível. Clique para ocultá-la."
                : "Clique para mostrar também a rota mais curta em metros."}
            >
              <span className="compare-swatch" />
              {showComparison ? "Comparando" : "Comparar"}
            </button>
          </div>
        )}

        {mapMode === "3d" && orbitDone && hasRoute && (
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

        <div className="toggle-wrap">
          {onTheaterToggle && (
            <button
              className={cn("view", theater && "active")}
              onClick={onTheaterToggle}
              title={theater ? "Devolver o mapa ao painel" : "Dar a largura da página ao mapa"}
            >
              {theater ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="view-label">Teatro</span>
            </button>
          )}

          <button
            className={cn("view", view === "full" && "active")}
            onClick={toggleFullscreen}
            title={view === "full" ? "Sair da tela cheia" : "Abrir em tela cheia"}
          >
            {view === "full" ? <Minimize size={14} /> : <Maximize size={14} />}
            <span className="view-label">Tela cheia</span>
          </button>
        </div>
      </div>

      {interactive && !hasRoute && (
        <p className="map-hint">Clique no mapa para marcar o destino</p>
      )}
    </div>
  )
}

export type { LngLat }
