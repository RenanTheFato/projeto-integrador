import maplibregl from "maplibre-gl"
import { ALL_COORDS } from "@/components/mapa/routes/utils"
import { ROUTE_ALT, ROUTE_COLOR } from "@/components/mapa/constants/constants"
import { addMarker } from "./markers"

export const addRouteLayers = (
  map: maplibregl.Map
) => {
  const flat = ALL_COORDS

  const lifted = ALL_COORDS.map(
    ([lng, lat]) =>
      [lng, lat, ROUTE_ALT] as [number, number, number]
  )

  // Source 2D
  map.addSource("src-flat", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: flat,
      },
      properties: {},
    },
  })

  // Source 3D elevado
  map.addSource("src-lifted", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: lifted,
      },
      properties: {},
    },
  })

  // Camadas 2D
  map.addLayer({
    id: "glow-2d",
    type: "line",
    source: "src-flat",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": ROUTE_COLOR,
      "line-width": 18,
      "line-opacity": 0.18,
      "line-blur": 4,
    },
  })

  map.addLayer({
    id: "line-2d",
    type: "line",
    source: "src-flat",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": ROUTE_COLOR,
      "line-width": 6,
      "line-opacity": 1,
    },
  })

  map.addLayer({
    id: "dash-2d",
    type: "line",
    source: "src-flat",
    layout: {
      "line-cap": "butt",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fff",
      "line-width": 1.5,
      "line-dasharray": [4, 6],
      "line-opacity": 0.35,
    },
  })

  // Camadas 3D
  map.addLayer({
    id: "shadow-3d",
    type: "line",
    source: "src-flat",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      "visibility": "none",
    },
    paint: {
      "line-color": "#000",
      "line-width": 8,
      "line-opacity": 0.2,
      "line-blur": 4,
    },
  })

  map.addLayer({
    id: "glow-3d",
    type: "line",
    source: "src-lifted",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      "visibility": "none",
    },
    paint: {
      "line-color": ROUTE_COLOR,
      "line-width": 24,
      "line-opacity": 0.18,
      "line-blur": 7,
    },
  })

  map.addLayer({
    id: "line-3d",
    type: "line",
    source: "src-lifted",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      "visibility": "none",
    },
    paint: {
      "line-color": ROUTE_COLOR,
      "line-width": 7,
      "line-opacity": 1,
    },
  })

  map.addLayer({
    id: "dash-3d",
    type: "line",
    source: "src-lifted",
    layout: {
      "line-cap": "butt",
      "line-join": "round",
      "visibility": "none",
    },
    paint: {
      "line-color": "#fff",
      "line-width": 2,
      "line-dasharray": [4, 6],
      "line-opacity": 0.4,
    },
  })

  // Marcadores fixos de origem / destino
  addMarker(
    map,
    ALL_COORDS[0],
    "#E53935",
    "B"
  )

  addMarker(
    map,
    ALL_COORDS[ALL_COORDS.length - 1],
    "#FFB300",
    "🔥"
  )
}

export const setLayerVisibility = (
  map: maplibregl.Map,
  show3d: boolean
) => {
  const v2 = show3d ? "none" : "visible"
  const v3 = show3d ? "visible" : "none"

  ;["glow-2d", "line-2d", "dash-2d"].forEach(
    id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          "visibility",
          v2
        )
      }
    }
  )

  ;["shadow-3d", "glow-3d", "line-3d", "dash-3d"].forEach(
    id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          "visibility",
          v3
        )
      }
    }
  )
}

export const setBuildingLayersVisibility = (
  map: maplibregl.Map,
  visible: boolean
) => {
  const vis = visible ? "visible" : "none"

  map.getStyle().layers.forEach(layer => {
    if (layer.id.toLowerCase().includes("building")) {
      map.setLayoutProperty(
        layer.id,
        "visibility",
        vis
      )
    }
  })
}