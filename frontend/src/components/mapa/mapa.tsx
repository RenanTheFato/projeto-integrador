import React, { useEffect, useRef, useState } from "react";
import { Map, Box, Globe, Navigation, ChevronDown } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { CamMode } from "./types/types";

import {
  ORBIT_PERIOD,
  STYLE,
  WAZE_PITCH,
  WAZE_ZOOM,
} from "./constants/constants";

import {
  ALL_COORDS,
  routeCenter,
  routeRadius,
  bearingBetween,
  pointAtDist,
  TOTAL_DIST_MT,
  FOLLOW_DURATION_MS,
} from "./routes/utils";

import {
  addArrowLayer,
  showArrow,
} from "./map/markers";

import {
  addRouteLayers,
  setLayerVisibility,
  setBuildingLayersVisibility,
} from "./map/layers";

import { fitRoute } from "./map/helpers";

import "./mapa.css";

// ─────────────────────────────────────────────────────────────────────────────

export default function Mapa() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const orbitRAF = useRef<number | null>(null);
  const orbitStart = useRef<number | null>(null);

  const followRAF = useRef<number | null>(null);
  const followStart = useRef<number | null>(null);

  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [orbitDone, setOrbitDone] = useState(false);
  const [camMode, setCamMode] = useState<CamMode>("free");
  const [dropOpen, setDropOpen] = useState(false);

  // ── Inicializa o mapa ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const [cx, cy] = routeCenter();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [cx, cy],
      zoom: 13.5,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;

    map.on("load", () => {
      addRouteLayers(map);
      addArrowLayer(map);
      fitRoute(map, ALL_COORDS);

      map.setMaxPitch(0);
      map.setMinZoom(10);
      map.setMaxZoom(16);

      setBuildingLayersVisibility(map, false);
    });

    return () => {
      stopOrbit();
      stopFollow();

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Controles de câmera ────────────────────────────────────────────────────

  const enableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.dragRotate.enable();
    map.touchZoomRotate.enable();
  };

  const disableFreeCamera = (map: maplibregl.Map) => {
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disable();
  };

  // ── Órbita panorâmica ──────────────────────────────────────────────────────

  const startOrbit = (map: maplibregl.Map) => {
    stopOrbit();

    setOrbitDone(false);
    orbitStart.current = null;

    disableFreeCamera(map);

    const [cx, cy] = routeCenter();
    const r = routeRadius();

    const targetZoom = Math.max(
      12,
      Math.min(15.5, 15.3 - r * 60)
    );

    map.flyTo({
      center: [cx, cy],
      zoom: targetZoom,
      pitch: 60,
      bearing: 0,
      duration: 1400,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

    map.once("moveend", () => {
      orbitStart.current = null;

      const loop = (ts: number) => {
        if (orbitStart.current === null) {
          orbitStart.current = ts;
        }

        const progress =
          (ts - orbitStart.current) / ORBIT_PERIOD;

        if (progress >= 1) {
          map.setBearing(0);

          stopOrbit();
          enableFreeCamera(map);

          setOrbitDone(true);
          setCamMode("free");

          return;
        }

        map.setBearing(progress * 360);

        orbitRAF.current =
          requestAnimationFrame(loop);
      };

      orbitRAF.current =
        requestAnimationFrame(loop);
    });
  };

  const stopOrbit = () => { 
  if (orbitRAF.current !== null) { 
    cancelAnimationFrame(orbitRAF.current); 
    orbitRAF.current = null; 
  } 
 
  orbitStart.current = null; 
}; 

  // ── Seguir Rota ────────────────────────────────────────────────────────────

  const startFollow = (map: maplibregl.Map) => {
    stopFollow();

    disableFreeCamera(map);
    followStart.current = null;

    showArrow(map, true);

    const origin = ALL_COORDS[0];
    const second = ALL_COORDS[1];

    const initBrg = bearingBetween(
      origin,
      second
    );

    map.flyTo({
      center: origin,
      zoom: WAZE_ZOOM,
      pitch: WAZE_PITCH,
      bearing: initBrg,
      duration: 1200,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

    map.once("moveend", () => {
      followStart.current = null;

      const loop = (ts: number) => {
        if (followStart.current === null) {
          followStart.current = ts;
        }

        const elapsed =
          ts - followStart.current;

        // distância percorrida em metros velocidade constante em km/h
        const d =
          (elapsed / FOLLOW_DURATION_MS) *
          TOTAL_DIST_MT;

        if (d >= TOTAL_DIST_MT) {
          // Chegou — para no destino
          stopFollow();
          enableFreeCamera(map);

          setCamMode("free");
          showArrow(map, false);

          return;
        }

        const cur = pointAtDist(d);

        // "olha para frente" 20 m à frente para bearing suave
        const next = pointAtDist(
          Math.min(d + 20, TOTAL_DIST_MT)
        );

        const brg = bearingBetween(
          cur,
          next
        );

        // Atualiza posição e rotação da seta via GeoJSON source
        const src =
          map.getSource("src-arrow") as
            | maplibregl.GeoJSONSource
            | undefined;

        if (src) {
          src.setData({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: cur,
            },
            properties: {
              bearing: brg,
            },
          });
        }

        // Câmera segue a seta com leve offset para frente (estilo Waze)
        map.jumpTo({
          center: cur,
          bearing: brg,
          pitch: WAZE_PITCH,
          zoom: WAZE_ZOOM,
        });

        followRAF.current =
          requestAnimationFrame(loop);
      };

      followRAF.current =
        requestAnimationFrame(loop);
    });
  };

  const stopFollow = () => {
  if (followRAF.current !== null) {
    cancelAnimationFrame(followRAF.current);
    followRAF.current = null;
  }

  followStart.current = null;
};

  // ── Troca de modo de câmera ────────────────────────────────────────────────

  const handleCamModeChange = (next: CamMode) => {
    const map = mapRef.current;

    if (!map) return;

    setDropOpen(false);

    if (next === camMode) return;

    setCamMode(next);

    if (next === "free") {
      stopFollow();
      showArrow(map, false);
      enableFreeCamera(map);
    } else {
      startFollow(map);
    }
  };

  // ── Toggle 2D / 3D ─────────────────────────────────────────────────────────

  const handleToggle = () => {
    const map = mapRef.current;

    if (!map) return;

    if (mapMode === "2d") {
      setMapMode("3d");
      setOrbitDone(false);
      setCamMode("free");

      setLayerVisibility(map, true);

      map.setMaxPitch(85);
      map.setMinZoom(10);
      map.setMaxZoom(20);

      setBuildingLayersVisibility(map, true);

      startOrbit(map);
    } else {
      setMapMode("2d");
      setOrbitDone(false);

      stopOrbit();
      stopFollow();

      showArrow(map, false);

      setLayerVisibility(map, false);

      map.setMaxPitch(0);
      map.setMaxZoom(16);

      setBuildingLayersVisibility(map, false);

      enableFreeCamera(map);

      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
        easing: (t) =>
          t < 0.5
            ? 2 * t * t
            : -1 + (4 - 2 * t) * t,
      });

      setTimeout(
        () => fitRoute(map, ALL_COORDS),
        820
      );
    }
  };

  // ── Opções de câmera ───────────────────────────────────────────────────────

  const CAM_OPTIONS: {
    value: CamMode;
    label: string;
    Icon: React.ElementType;
  }[] = [
    {
      value: "free",
      label: "Livre",
      Icon: Globe,
    },
    {
      value: "follow",
      label: "Seguir Rota",
      Icon: Navigation,
    },
  ];

  const currentCam = CAM_OPTIONS.find(
    (o) => o.value === camMode
  )!;

  const CurrentCamIcon = currentCam.Icon;

  // ── Interface ──────────────────────────────────────────────────────────────

  return (
    <div className="map-wrap flex items-center justify-center xl:mt-3 h-150 mr-1 xl:h-159 xl:w-368 rounded-md border">
      <div
        ref={containerRef}
        className="map"
      />

      <div className="top-controls">
        <div className="toggle-wrap">
          <button
            className={
              mapMode === "2d"
                ? "active"
                : ""
            }
            onClick={() =>
              mapMode !== "2d" &&
              handleToggle()
            }
          >
            <Map size={14} />
            2D
          </button>

          <button
            className={
              mapMode === "3d"
                ? "active"
                : ""
            }
            onClick={() =>
              mapMode !== "3d" &&
              handleToggle()
            }
          >
            <Box size={14} />
            3D
          </button>
        </div>

        {mapMode === "3d" &&
          orbitDone && (
            <div className="cam-dropdown">
              <div
                className={`cam-trigger ${
                  dropOpen
                    ? "open"
                    : ""
                }`}
                onClick={() =>
                  setDropOpen(
                    (v) => !v
                  )
                }
              >
                <CurrentCamIcon
                  size={14}
                  style={{
                    opacity: 0.7,
                  }}
                />

                {currentCam.label}

                <ChevronDown
                  size={12}
                  className={`cam-chevron ${
                    dropOpen
                      ? "open"
                      : ""
                  }`}
                />
              </div>

              {dropOpen && (
                <div className="cam-menu">
                  {CAM_OPTIONS.map(
                    (opt) => (
                      <div
                        key={opt.value}
                        className={`cam-option ${
                          camMode ===
                          opt.value
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleCamModeChange(
                            opt.value
                          )
                        }
                      >
                        <opt.Icon
                          size={14}
                        />

                        {opt.label}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}