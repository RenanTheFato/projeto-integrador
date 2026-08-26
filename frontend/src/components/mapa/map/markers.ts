import maplibregl from "maplibre-gl"
import { ALL_COORDS } from "@/components/mapa/routes/utils"

export const addMarker = (
  map: maplibregl.Map,
  coords: [number, number],
  color: string,
  label: string
) => {
  const el = document.createElement("div")

  el.style.cssText = `
    width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;
    box-shadow:0 0 14px ${color}99,0 2px 6px rgba(0,0,0,.45);
    display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:700;color:#fff;font-family:sans-serif;cursor:default;
  `

  el.textContent = label

  new maplibregl.Marker({ element: el })
    .setLngLat(coords)
    .addTo(map)
}

export const addArrowLayer = (
  map: maplibregl.Map
) => {
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

  const img = new Image()

  img.src =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(svg)

  img.onload = () => {
    if (!map.hasImage("nav-arrow-icon")) {
      map.addImage("nav-arrow-icon", img)
    }

    map.addSource("src-arrow", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: ALL_COORDS[0],
        },
        properties: {
          bearing: 0,
        },
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

export const showArrow = (
  map: maplibregl.Map,
  visible: boolean
) => {
  if (!map || !map.getLayer("layer-arrow")) return;

  map.setLayoutProperty(
    "layer-arrow",
    "visibility",
    visible ? "visible" : "none"
  );
};