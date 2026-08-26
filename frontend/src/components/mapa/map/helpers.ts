import maplibregl from "maplibre-gl"

export const fitRoute = (
  map: maplibregl.Map,
  coords: [number, number][]
) => {
  const bounds = new maplibregl.LngLatBounds();

  coords.forEach(c => bounds.extend(c));

  map.fitBounds(bounds, {
    padding: 80,
    duration: 800,
  });
};