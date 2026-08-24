import React, { useEffect, useRef, useState } from "react";
import { Map, Box, Globe, Navigation, ChevronDown } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface Waypoint {
  name: string
  coordinates: [number, number] // [lng, lat]
}

type CamMode = "free" | "follow"

// ─── DADOS DA ROTA ────────────────────────────────────────────────────────────
// [longitude, latitude]
const WAYPOINTS: Waypoint[] = [
  { name: "Quartel Central", coordinates: [-45.85967, -23.1814] },
  { name: "", coordinates: [-45.85969, -23.18143] },
  { name: "", coordinates: [-45.85973, -23.18145] },
  { name: "", coordinates: [-45.85978, -23.18147] },
  { name: "", coordinates: [-45.85987, -23.1815] },
  { name: "", coordinates: [-45.85987, -23.1815] },
  { name: "", coordinates: [-45.85963, -23.18195] },
  { name: "", coordinates: [-45.85955, -23.18209] },
  { name: "", coordinates: [-45.85939, -23.18238] },
  { name: "", coordinates: [-45.85934, -23.18246] },
  { name: "", coordinates: [-45.85923, -23.18266] },
  { name: "", coordinates: [-45.85918, -23.18274] },
  { name: "", coordinates: [-45.85907, -23.18293] },
  { name: "", coordinates: [-45.85897, -23.1831] },
  { name: "", coordinates: [-45.85866, -23.18368] },
  { name: "", coordinates: [-45.85866, -23.18368] },
  { name: "", coordinates: [-45.85861, -23.18376] },
  { name: "", coordinates: [-45.85849, -23.18369] },
  { name: "", coordinates: [-45.8583, -23.18359] },
  { name: "", coordinates: [-45.85824, -23.18355] },
  { name: "", coordinates: [-45.85819, -23.18352] },
  { name: "", coordinates: [-45.85819, -23.18352] },
  { name: "", coordinates: [-45.85786, -23.18367] },
  { name: "", coordinates: [-45.85728, -23.18397] },
  { name: "", coordinates: [-45.85663, -23.1843] },
  { name: "", coordinates: [-45.85641, -23.1844] },
  { name: "", coordinates: [-45.85632, -23.18445] },
  { name: "", coordinates: [-45.85611, -23.18455] },
  { name: "", coordinates: [-45.85585, -23.18467] },
  { name: "", coordinates: [-45.85524, -23.18494] },
  { name: "", coordinates: [-45.85474, -23.18518] },
  { name: "", coordinates: [-45.85459, -23.18525] },
  { name: "", coordinates: [-45.85449, -23.18532] },
  { name: "", coordinates: [-45.85444, -23.18537] },
  { name: "", coordinates: [-45.85442, -23.18543] },
  { name: "", coordinates: [-45.85442, -23.18543] },
  { name: "", coordinates: [-45.85443, -23.18545] },
  { name: "", coordinates: [-45.85442, -23.18546] },
  { name: "", coordinates: [-45.85442, -23.18546] },
  { name: "", coordinates: [-45.85455, -23.18552] },
  { name: "", coordinates: [-45.85475, -23.18558] },
  { name: "", coordinates: [-45.85475, -23.18558] },
  { name: "", coordinates: [-45.85479, -23.18573] },
  { name: "", coordinates: [-45.85479, -23.18584] },
  { name: "", coordinates: [-45.85476, -23.1859] },
  { name: "", coordinates: [-45.85454, -23.18627] },
  { name: "", coordinates: [-45.85453, -23.18642] },
  { name: "", coordinates: [-45.85457, -23.18654] },
  { name: "", coordinates: [-45.85457, -23.18654] },
  { name: "", coordinates: [-45.85603, -23.18731] },
  { name: "", coordinates: [-45.85713, -23.18788] },
  { name: "", coordinates: [-45.85841, -23.18859] },
  { name: "", coordinates: [-45.85909, -23.18897] },
  { name: "", coordinates: [-45.85909, -23.18897] },
  { name: "", coordinates: [-45.86369, -23.19125] },
  { name: "", coordinates: [-45.86389, -23.19135] },
  { name: "", coordinates: [-45.86438, -23.19159] },
  { name: "", coordinates: [-45.86506, -23.19192] },
  { name: "", coordinates: [-45.86646, -23.19264] },
  { name: "", coordinates: [-45.86866, -23.19371] },
  { name: "", coordinates: [-45.86953, -23.19417] },
  { name: "", coordinates: [-45.8702, -23.19451] },
  { name: "", coordinates: [-45.87279, -23.19582] },
  { name: "", coordinates: [-45.87345, -23.19617] },
  { name: "", coordinates: [-45.87345, -23.19617] },
  { name: "", coordinates: [-45.8738, -23.19624] },
  { name: "", coordinates: [-45.87409, -23.19625] },
  { name: "", coordinates: [-45.87428, -23.19626] },
  { name: "", coordinates: [-45.87456, -23.19632] },
  { name: "", coordinates: [-45.87456, -23.19632] },
  { name: "", coordinates: [-45.87512, -23.19669] },
  { name: "", coordinates: [-45.87547, -23.19692] },
  { name: "", coordinates: [-45.87631, -23.19746] },
  { name: "", coordinates: [-45.87635, -23.19749] },
  { name: "", coordinates: [-45.87637, -23.19751] },
  { name: "", coordinates: [-45.87652, -23.19761] },
  { name: "", coordinates: [-45.8771, -23.19801] },
  { name: "", coordinates: [-45.87767, -23.19845] },
  { name: "", coordinates: [-45.87785, -23.19861] },
  { name: "", coordinates: [-45.87792, -23.19866] },
  { name: "", coordinates: [-45.87822, -23.19891] },
  { name: "", coordinates: [-45.87841, -23.19906] },
  { name: "", coordinates: [-45.87888, -23.19944] },
  { name: "", coordinates: [-45.87929, -23.19982] },
  { name: "", coordinates: [-45.87972, -23.20022] },
  { name: "", coordinates: [-45.88023, -23.20072] },
  { name: "", coordinates: [-45.88043, -23.20092] },
  { name: "", coordinates: [-45.88108, -23.20156] },
  { name: "", coordinates: [-45.8812, -23.20168] },
  { name: "", coordinates: [-45.88123, -23.20171] },
  { name: "", coordinates: [-45.88146, -23.20192] },
  { name: "", coordinates: [-45.88152, -23.20199] },
  { name: "", coordinates: [-45.88194, -23.20238] },
  { name: "", coordinates: [-45.88209, -23.20251] },
  { name: "", coordinates: [-45.88283, -23.20318] },
  { name: "", coordinates: [-45.88316, -23.20348] },
  { name: "", coordinates: [-45.88316, -23.20348] },
  { name: "", coordinates: [-45.88351, -23.2037] },
  { name: "", coordinates: [-45.88372, -23.20374] },
  { name: "", coordinates: [-45.88398, -23.20376] },
  { name: "", coordinates: [-45.88419, -23.20372] },
  { name: "", coordinates: [-45.88439, -23.20366] },
  { name: "", coordinates: [-45.88459, -23.20346] },
  { name: "", coordinates: [-45.88478, -23.20329] },
  { name: "", coordinates: [-45.88478, -23.20329] },
  { name: "", coordinates: [-45.88486, -23.2031] },
  { name: "", coordinates: [-45.88499, -23.20281] },
  { name: "", coordinates: [-45.88513, -23.20243] },
  { name: "", coordinates: [-45.88518, -23.20227] },
  { name: "", coordinates: [-45.88528, -23.20189] },
  { name: "", coordinates: [-45.8854, -23.20144] },
  { name: "", coordinates: [-45.8855, -23.20109] },
  { name: "", coordinates: [-45.88569, -23.20037] },
  { name: "", coordinates: [-45.8857, -23.20029] },
  { name: "", coordinates: [-45.8857, -23.20029] },
  { name: "", coordinates: [-45.88581, -23.20002] },
  { name: "", coordinates: [-45.88599, -23.19896] },
  { name: "", coordinates: [-45.88606, -23.19855] },
  { name: "", coordinates: [-45.88606, -23.19855] },
  { name: "", coordinates: [-45.8862, -23.19829] },
  { name: "", coordinates: [-45.88627, -23.19822] },
  { name: "", coordinates: [-45.88636, -23.19816] },
  { name: "", coordinates: [-45.88648, -23.19811] },
  { name: "", coordinates: [-45.88669, -23.19807] },
  { name: "", coordinates: [-45.88706, -23.19811] },
  { name: "", coordinates: [-45.88706, -23.19811] },
  { name: "", coordinates: [-45.88696, -23.19854] },
  { name: "", coordinates: [-45.88696, -23.19854] },
  { name: "", coordinates: [-45.88701, -23.19856] },
  { name: "", coordinates: [-45.8876, -23.19874] },
  { name: "", coordinates: [-45.88806, -23.19888] },
  { name: "", coordinates: [-45.88854, -23.19904] },
  { name: "", coordinates: [-45.88915, -23.19921] },
  { name: "", coordinates: [-45.88922, -23.19924] },
  { name: "", coordinates: [-45.88963, -23.19937] },
  { name: "", coordinates: [-45.88979, -23.19941] },
  { name: "", coordinates: [-45.88999, -23.1994] },
  { name: "", coordinates: [-45.88999, -23.1994] },
  { name: "", coordinates: [-45.89041, -23.19926] },
  { name: "", coordinates: [-45.89043, -23.19925] },
  { name: "", coordinates: [-45.89075, -23.19914] },
  { name: "", coordinates: [-45.89155, -23.19885] },
  { name: "", coordinates: [-45.89169, -23.1988] },
  { name: "", coordinates: [-45.89175, -23.19878] },
  { name: "", coordinates: [-45.89182, -23.19875] },
  { name: "", coordinates: [-45.89203, -23.19868] },
  { name: "", coordinates: [-45.89248, -23.19853] },
  { name: "", coordinates: [-45.89309, -23.19833] },
  { name: "", coordinates: [-45.89318, -23.1983] },
  { name: "", coordinates: [-45.89381, -23.19809] },
  { name: "", coordinates: [-45.89455, -23.19785] },
  { name: "", coordinates: [-45.89463, -23.19782] },
  { name: "", coordinates: [-45.8947, -23.1978] },
  { name: "", coordinates: [-45.89472, -23.19779] },
  { name: "", coordinates: [-45.89475, -23.19778] },
  { name: "", coordinates: [-45.89573, -23.19744] },
  { name: "", coordinates: [-45.89632, -23.19725] },
  { name: "Local do Incêndio", coordinates: [-45.89632, -23.19725] },
]

const ROUTE_COLOR = "#E53935" // cor única da rota
const ROUTE_ALT = 25        // altura do relevo 3D em metros
const ORBIT_PERIOD = 7_000     // ms por volta panorâmica

// Velocidade do Seguir Rota em km/h (ajuste aqui)
const FOLLOW_KMH = 280

const STYLE = "https://tiles.openfreemap.org/styles/liberty"

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ALL_COORDS = WAYPOINTS.map((w) => w.coordinates)

const routeCenter = (): [number, number] => {
  const lngs = ALL_COORDS.map((c) => c[0])
  const lats = ALL_COORDS.map((c) => c[1])
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2,
  (Math.min(...lats) + Math.max(...lats)) / 2]
}

const routeRadius = (): number => {
  const lngs = ALL_COORDS.map((c) => c[0])
  const lats = ALL_COORDS.map((c) => c[1])
  return Math.max((Math.max(...lngs) - Math.min(...lngs)) / 2,
    (Math.max(...lats) - Math.min(...lats)) / 2)
}

// Distância em metros entre dois pontos [lng, lat] via Haversine
const haversineMt = (a: [number, number], b: [number, number]): number => {
  const R = 6_371_000
  const φ1 = (a[1] * Math.PI) / 180, φ2 = (b[1] * Math.PI) / 180
  const Δφ = ((b[1] - a[1]) * Math.PI) / 180
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

// Distâncias acumuladas em metros
const buildCumDist = (): number[] => {
  const cum = [0]
  for (let i = 0; i < ALL_COORDS.length - 1; i++)
    cum.push(cum[i] + haversineMt(ALL_COORDS[i], ALL_COORDS[i + 1]))
  return cum
}
const CUM_DIST_MT = buildCumDist()
const TOTAL_DIST_MT = CUM_DIST_MT[CUM_DIST_MT.length - 1]

// ms necessários para percorrer a rota na velocidade configurada
const FOLLOW_DURATION_MS = (TOTAL_DIST_MT / 1000) / FOLLOW_KMH * 1_600_000

// Posição ao longo da rota dado d em metros percorridos
const pointAtDist = (d: number): [number, number] => {
  const clamped = Math.min(d, TOTAL_DIST_MT)
  let i = 0
  while (i < CUM_DIST_MT.length - 2 && CUM_DIST_MT[i + 1] < clamped) i++
  const segLen = CUM_DIST_MT[i + 1] - CUM_DIST_MT[i]
  const f = segLen > 0 ? (clamped - CUM_DIST_MT[i]) / segLen : 0
  const a = ALL_COORDS[i], b = ALL_COORDS[Math.min(i + 1, ALL_COORDS.length - 1)]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

// Bearing geográfico real entre dois pontos
const bearingBetween = (a: [number, number], b: [number, number]): number => {
  const φ1 = (a[1] * Math.PI) / 180, φ2 = (b[1] * Math.PI) / 180
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180) / Math.PI
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const orbitRAF = useRef<number | null>(null)
  const orbitStart = useRef<number | null>(null)
  const followRAF = useRef<number | null>(null)
  const followStart = useRef<number | null>(null)

  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d")
  const [orbitDone, setOrbitDone] = useState(false)
  const [camMode, setCamMode] = useState<CamMode>("free")
  const [dropOpen, setDropOpen] = useState(false)

  // ── Inicializa o mapa ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const [cx, cy] = routeCenter()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [cx, cy],
      zoom: 13.5,
      pitch: 0,
      bearing: 0,
    })
    mapRef.current = map

    map.on("load", () => {
      addRouteLayers(map)
      addArrowLayer(map)
      fitRoute(map)
      map.setMaxPitch(0)
      map.setMinZoom(10)
      map.setMaxZoom(16)
      setBuildingLayersVisibility(map, false)
    })

    return () => { stopOrbit(); stopFollow(); map.remove(); mapRef.current = null; };
  }, []);

  // ── Camadas de rota (uma só cor) ───────────────────────────────────────────
  const addRouteLayers = (map: maplibregl.Map) => {
    const flat = ALL_COORDS
    const lifted = ALL_COORDS.map(([lng, lat]) => [lng, lat, ROUTE_ALT] as [number, number, number])

    // Source 2D
    map.addSource("src-flat", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: flat }, properties: {} },
    })
    // Source 3D elevado
    map.addSource("src-lifted", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: lifted }, properties: {} },
    })

    // Camadas 2D
    map.addLayer({
      id: "glow-2d", type: "line", source: "src-flat",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ROUTE_COLOR, "line-width": 18, "line-opacity": 0.18, "line-blur": 4 }
    })
    map.addLayer({
      id: "line-2d", type: "line", source: "src-flat",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ROUTE_COLOR, "line-width": 6, "line-opacity": 1 }
    })
    map.addLayer({
      id: "dash-2d", type: "line", source: "src-flat",
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: { "line-color": "#fff", "line-width": 1.5, "line-dasharray": [4, 6], "line-opacity": 0.35 }
    })

    // Camadas 3D
    map.addLayer({
      id: "shadow-3d", type: "line", source: "src-flat",
      layout: { "line-cap": "round", "line-join": "round", "visibility": "none" },
      paint: { "line-color": "#000", "line-width": 8, "line-opacity": 0.2, "line-blur": 4 }
    })
    map.addLayer({
      id: "glow-3d", type: "line", source: "src-lifted",
      layout: { "line-cap": "round", "line-join": "round", "visibility": "none" },
      paint: { "line-color": ROUTE_COLOR, "line-width": 24, "line-opacity": 0.18, "line-blur": 7 }
    })
    map.addLayer({
      id: "line-3d", type: "line", source: "src-lifted",
      layout: { "line-cap": "round", "line-join": "round", "visibility": "none" },
      paint: { "line-color": ROUTE_COLOR, "line-width": 7, "line-opacity": 1 }
    })
    map.addLayer({
      id: "dash-3d", type: "line", source: "src-lifted",
      layout: { "line-cap": "butt", "line-join": "round", "visibility": "none" },
      paint: { "line-color": "#fff", "line-width": 2, "line-dasharray": [4, 6], "line-opacity": 0.4 }
    })

    // Marcadores fixos de origem / destino
    addMarker(map, ALL_COORDS[0], "#E53935", "B")
    addMarker(map, ALL_COORDS[ALL_COORDS.length - 1], "#FFB300", "🔥")
  };

  const addMarker = (map: maplibregl.Map, coords: [number, number], color: string, label: string) => {
    const el = document.createElement("div")
    el.style.cssText = `
      width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;
      box-shadow:0 0 14px ${color}99,0 2px 6px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:700;color:#fff;font-family:sans-serif;cursor:default;
    `;
    el.textContent = label
    new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map)
  }

  // Seta de navegação nativa 
  // Renderiza no espaço 3D do mapa sem quadrado, sem desalinhamento de perspectiva
  const addArrowLayer = (map: maplibregl.Map) => {
    // Cria o ícone SVG como ImageBitmap e registra no mapa
    const size = 64
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64"
           xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="32" cy="58" rx="14" ry="4" fill="rgba(0,0,0,0.25)"/>
        <!-- corpo da seta estilo Waze -->
        <path d="M32 4 L50 52 L32 42 L14 52 Z"
              fill="#1565C0" stroke="white" stroke-width="3"
              stroke-linejoin="round"/>
        <path d="M32 12 L44 46 L32 38 L20 46 Z"
              fill="rgba(255,255,255,0.18)"/>
      </svg>`;

    const img = new Image()
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
    img.onload = () => {
      if (!map.hasImage("nav-arrow-icon")) {
        map.addImage("nav-arrow-icon", img)
      }

      // Source GeoJSON com ponto na origem
      map.addSource("src-arrow", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: ALL_COORDS[0] },
          properties: { bearing: 0 },
        },
      })

      // Camada symbol — roda com o bearing e fica no espaço 3D
      map.addLayer({
        id: "layer-arrow",
        type: "symbol",
        source: "src-arrow",
        layout: {
          "icon-image": "nav-arrow-icon",
          "icon-size": 0.9,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",   // alinha com o mapa (perspectiva correta)
          "icon-pitch-alignment": "map",       // inclina com o pitch 3D
          "icon-allow-overlap": true,
          "visibility": "none",
        },
      })
    }
  }

  // ── Visibilidade das camadas ───────────────────────────────────────────────
  const setLayerVisibility = (map: maplibregl.Map, show3d: boolean) => {
    const v2 = show3d ? "none" : "visible";
    const v3 = show3d ? "visible" : "none";
    ["glow-2d", "line-2d", "dash-2d"].forEach(id => map.setLayoutProperty(id, "visibility", v2));
    ["shadow-3d", "glow-3d", "line-3d", "dash-3d"].forEach(id => map.setLayoutProperty(id, "visibility", v3));
  }

  const setBuildingLayersVisibility = (map: maplibregl.Map, visible: boolean) => {
    const vis = visible ? "visible" : "none";
    map.getStyle().layers.forEach(layer => {
      if (layer.id.toLowerCase().includes("building"))
        map.setLayoutProperty(layer.id, "visibility", vis);
    })
  }

  const showArrow = (visible: boolean) => {
    const map = mapRef.current;
    if (!map || !map.getLayer("layer-arrow")) return;
    map.setLayoutProperty("layer-arrow", "visibility", visible ? "visible" : "none");
  };

  // controles de câmera
  const enableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.enable(); map.scrollZoom.enable()
    map.dragRotate.enable(); map.touchZoomRotate.enable()
  }
  const disableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.disable(); map.scrollZoom.disable()
    map.dragRotate.disable(); map.touchZoomRotate.disable()
  }

  // orbita panorâmica 
  const startOrbit = (map: maplibregl.Map) => {
    stopOrbit()
    setOrbitDone(false)
    orbitStart.current = null
    disableFreeCamera(map)

    const [cx, cy] = routeCenter()
    const r = routeRadius()
    const targetZoom = Math.max(12, Math.min(15.5, 15.3 - r * 60))

    map.flyTo({
      center: [cx, cy], zoom: targetZoom, pitch: 60, bearing: 0,
      duration: 1400, easing: t => 1 - Math.pow(1 - t, 3)
    })

    map.once("moveend", () => {
      orbitStart.current = null
      const loop = (ts: number) => {
        if (orbitStart.current === null) orbitStart.current = ts
        const progress = (ts - orbitStart.current) / ORBIT_PERIOD
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

  const stopOrbit = () => {
    if (orbitRAF.current !== null) { cancelAnimationFrame(orbitRAF.current); orbitRAF.current = null; }
    orbitStart.current = null;
  }

  // Seguir Rota estilo Waze 
  // Câmera mais alta e atrás da seta, como no Waze (pitch 55, zoom 17)
  const WAZE_PITCH = 55
  const WAZE_ZOOM = 17

  const startFollow = (map: maplibregl.Map) => {
    stopFollow()
    disableFreeCamera(map)
    followStart.current = null
    showArrow(true)

    const origin = ALL_COORDS[0]
    const second = ALL_COORDS[1]
    const initBrg = bearingBetween(origin, second)

    map.flyTo({
      center: origin, zoom: WAZE_ZOOM, pitch: WAZE_PITCH, bearing: initBrg,
      duration: 1200, easing: t => 1 - Math.pow(1 - t, 3),
    })

    map.once("moveend", () => {
      followStart.current = null

      const loop = (ts: number) => {
        if (followStart.current === null) followStart.current = ts
        const elapsed = ts - followStart.current

        // distância percorrida em metros velocidade constante em km/h
        const d = (elapsed / FOLLOW_DURATION_MS) * TOTAL_DIST_MT

        if (d >= TOTAL_DIST_MT) {
          // Chegou — para no destino
          stopFollow()
          enableFreeCamera(map)
          setCamMode("free")
          showArrow(false)
          return
        }

        const cur = pointAtDist(d)
        // "olha para frente" 20 m à frente para bearing suave
        const next = pointAtDist(Math.min(d + 20, TOTAL_DIST_MT))
        const brg = bearingBetween(cur, next)

        // Atualiza posição e rotação da seta via GeoJSON source
        const src = map.getSource("src-arrow") as maplibregl.GeoJSONSource | undefined
        if (src) {
          src.setData({
            type: "Feature",
            geometry: { type: "Point", coordinates: cur },
            properties: { bearing: brg },
          })
        }

        // Câmera segue a seta com leve offset para frente (estilo Waze)
        map.jumpTo({ center: cur, bearing: brg, pitch: WAZE_PITCH, zoom: WAZE_ZOOM })

        followRAF.current = requestAnimationFrame(loop)
      }
      followRAF.current = requestAnimationFrame(loop)
    })
  }

  const stopFollow = () => {
    if (followRAF.current !== null) { cancelAnimationFrame(followRAF.current); followRAF.current = null; }
    followStart.current = null
  };

  // Troca de modo de câmera 
  const handleCamModeChange = (next: CamMode) => {
    const map = mapRef.current
    if (!map) return
    setDropOpen(false)
    if (next === camMode) return
    setCamMode(next)

    if (next === "free") {
      stopFollow()
      showArrow(false)
      enableFreeCamera(map)
    } else {
      startFollow(map)
    }
  }

  // Fit da rota
  const fitRoute = (map: maplibregl.Map) => {
    const bounds = new maplibregl.LngLatBounds()
    ALL_COORDS.forEach(c => bounds.extend(c))
    map.fitBounds(bounds, { padding: 80, duration: 800 })
  }

  //Toggle 2D 3D
  const handleToggle = () => {
    const map = mapRef.current
    if (!map) return

    if (mapMode === "2d") {
      setMapMode("3d"); setOrbitDone(false); setCamMode("free");
      setLayerVisibility(map, true);
      map.setMaxPitch(85); map.setMinZoom(10); map.setMaxZoom(20);
      setBuildingLayersVisibility(map, true);
      startOrbit(map);
    } else {
      setMapMode("2d"); setOrbitDone(false);
      stopOrbit(); stopFollow();
      showArrow(false);
      setLayerVisibility(map, false);
      map.setMaxPitch(0); map.setMaxZoom(16);
      setBuildingLayersVisibility(map, false);
      enableFreeCamera(map);
      map.easeTo({
        pitch: 0, bearing: 0, duration: 800,
        easing: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      });
      setTimeout(() => fitRoute(map), 820);
    }
  }

  const CAM_OPTIONS: { value: CamMode; label: string; Icon: React.ElementType }[] = [
    { value: "free", label: "Livre", Icon: Globe },
    { value: "follow", label: "Seguir Rota", Icon: Navigation },
  ];
  const currentCam = CAM_OPTIONS.find(o => o.value === camMode)!
  const CurrentCamIcon = currentCam.Icon

  // Lib DropDown Auto Generated
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; }
        .map-wrap { position: relative; width: 100%; height: 100vh; }
        .map      { position: absolute; inset: 0; }
        .maplibregl-ctrl-bottom-left,
        .maplibregl-ctrl-bottom-right { display: none; }

        .top-controls {
          position: absolute; top: 16px; left: 50%;
          transform: translateX(-50%); z-index: 20;
          display: flex; align-items: center; gap: 8px;
        }

        .toggle-wrap {
          display: flex;
          background: rgba(0,0,0,0.62);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 10px; padding: 4px; gap: 4px;
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        }
        .toggle-wrap button {
          padding: 8px 24px; border: none; border-radius: 7px;
          font-family: system-ui, sans-serif; font-size: 13px;
          font-weight: 600; letter-spacing: .5px; cursor: pointer;
          transition: background .2s, color .2s;
          background: transparent; color: rgba(255,255,255,.42);
          display: flex; align-items: center; gap: 6px; white-space: nowrap;
        }
        .toggle-wrap button.active { background: #E53935; color: #fff; }
        .toggle-wrap button:hover:not(.active) {
          background: rgba(255,255,255,.09); color: rgba(255,255,255,.82);
        }

        .cam-dropdown { position: relative; }
        .cam-trigger {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 14px 8px 12px;
          background: rgba(0,0,0,0.62);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 10px;
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          cursor: pointer; transition: border-color .2s, background .2s;
          white-space: nowrap; font-family: system-ui, sans-serif;
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,.85); user-select: none;
        }
        .cam-trigger:hover { background: rgba(0,0,0,.75); border-color: rgba(255,255,255,.28); }
        .cam-trigger.open  { border-color: rgba(255,255,255,.35); }
        .cam-chevron {
          width: 12px; height: 12px; margin-left: 2px;
          transition: transform .2s; opacity: .6;
        }
        .cam-chevron.open { transform: rotate(180deg); }
        .cam-menu {
          position: absolute; top: calc(100% + 6px); left: 50%;
          transform: translateX(-50%); min-width: 100%;
          background: rgba(10,10,15,0.92);
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 10px; overflow: hidden;
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 8px 24px rgba(0,0,0,.5); z-index: 30;
        }
        .cam-option {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 16px; cursor: pointer;
          font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,.65);
          transition: background .15s, color .15s; white-space: nowrap;
        }
        .cam-option:hover    { background: rgba(255,255,255,.07); color: #fff; }
        .cam-option.selected { color: #fff; background: rgba(229,57,53,.18); }
        .cam-option.selected svg { color: #E53935; }
      `}</style>

      <div className="map-wrap">
        <div ref={containerRef} className="map" />

        <div className="top-controls">
          <div className="toggle-wrap">
            <button className={mapMode === "2d" ? "active" : ""}
              onClick={() => mapMode !== "2d" && handleToggle()}>
              <Map size={14} /> 2D
            </button>
            <button className={mapMode === "3d" ? "active" : ""}
              onClick={() => mapMode !== "3d" && handleToggle()}>
              <Box size={14} /> 3D
            </button>
          </div>

          {mapMode === "3d" && orbitDone && (
            <div className="cam-dropdown">
              <div className={`cam-trigger ${dropOpen ? "open" : ""}`}
                onClick={() => setDropOpen(v => !v)}>
                <CurrentCamIcon size={14} style={{ opacity: 0.7 }} />
                {currentCam.label}
                <ChevronDown size={12} className={`cam-chevron ${dropOpen ? "open" : ""}`} />
              </div>
              {dropOpen && (
                <div className="cam-menu">
                  {CAM_OPTIONS.map(opt => (
                    <div key={opt.value}
                      className={`cam-option ${camMode === opt.value ? "selected" : ""}`}
                      onClick={() => handleCamModeChange(opt.value)}>
                      <opt.Icon size={14} />
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}