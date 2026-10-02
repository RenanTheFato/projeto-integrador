/**
 * Live vehicles on a map (AVL).
 *
 * One small chip per vehicle with its prefix, coloured by status: teal for a
 * vehicle on a call, green for one that is free. Markers are kept by id and
 * only moved when a position report arrives, so a fleet updating every few
 * seconds never rebuilds the DOM.
 */

import maplibregl from "maplibre-gl"

export interface LiveVehicle {
  id: string
  prefix: string
  status: string
  latitude: number
  longitude: number
}

const STATUS_COLOR: Record<string, string> = {
  EMPENHADA: "#0B63A5",
  DISPONIVEL: "#2F6A52",
}

function chip(vehicle: LiveVehicle): HTMLElement {
  const element = document.createElement("div")
  element.className = "map-vehicle-marker"
  element.setAttribute("role", "img")
  element.setAttribute("aria-label", `Viatura ${vehicle.prefix}`)
  paint(element, vehicle)
  return element
}

function paint(element: HTMLElement, vehicle: LiveVehicle) {
  const color = STATUS_COLOR[vehicle.status] ?? "#64748B"
  element.style.cssText = `
    padding:1px 5px;border-radius:2px;background:${color};color:#fff;border:1.5px solid #edf1ef;
    font:600 10px/1.4 Inter, system-ui, sans-serif;letter-spacing:.02em;white-space:nowrap;
    box-shadow:0 1px 4px rgba(15,23,32,.35);transition:transform .8s linear;
  `
  element.textContent = vehicle.prefix
  element.title = `${vehicle.prefix} · ${vehicle.status === "EMPENHADA" ? "empenhada" : vehicle.status === "DISPONIVEL" ? "disponível" : vehicle.status.toLowerCase()}`
}

export function syncVehicleMarkers(
  map: maplibregl.Map,
  markers: Map<string, maplibregl.Marker>,
  vehicles: LiveVehicle[],
) {
  const seen = new Set<string>()

  for (const vehicle of vehicles) {
    seen.add(vehicle.id)
    const at: [number, number] = [vehicle.longitude, vehicle.latitude]
    const existing = markers.get(vehicle.id)
    if (existing) {
      existing.setLngLat(at)
      paint(existing.getElement(), vehicle)
    } else {
      markers.set(vehicle.id, new maplibregl.Marker({ element: chip(vehicle), anchor: "bottom", offset: [0, -4] }).setLngLat(at).addTo(map))
    }
  }

  for (const [id, marker] of markers) {
    if (!seen.has(id)) {
      marker.remove()
      markers.delete(id)
    }
  }
}
