import { FOLLOW_KMH } from "../constants/constants";
import { WAYPOINTS } from "./data";

export const ALL_COORDS = WAYPOINTS.map(
  (w) => w.coordinates
);

export const routeCenter = (): [number, number] => {
  const lngs = ALL_COORDS.map((c) => c[0]);
  const lats = ALL_COORDS.map((c) => c[1]);

  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
};

export const routeRadius = (): number => {
  const lngs = ALL_COORDS.map((c) => c[0]);
  const lats = ALL_COORDS.map((c) => c[1]);

  return Math.max(
    (Math.max(...lngs) - Math.min(...lngs)) / 2,
    (Math.max(...lats) - Math.min(...lats)) / 2
  );
};

export const haversineMt = (
  a: [number, number],
  b: [number, number]
): number => {
  const R = 6_371_000;

  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;

  const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;

  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
  );
};

export const buildCumDist = (): number[] => {
  const cum = [0];

  for (let i = 0; i < ALL_COORDS.length - 1; i++) {
    cum.push(
      cum[i] +
        haversineMt(
          ALL_COORDS[i],
          ALL_COORDS[i + 1]
        )
    );
  }

  return cum;
};

export const CUM_DIST_MT = buildCumDist();

export const TOTAL_DIST_MT =
  CUM_DIST_MT[CUM_DIST_MT.length - 1];

export const FOLLOW_DURATION_MS =
  (TOTAL_DIST_MT / 1000) /
  FOLLOW_KMH *
  1_600_000;

export const pointAtDist = (
  d: number
): [number, number] => {
  const clamped = Math.min(d, TOTAL_DIST_MT);

  let i = 0;

  while (
    i < CUM_DIST_MT.length - 2 &&
    CUM_DIST_MT[i + 1] < clamped
  ) {
    i++;
  }

  const segLen =
    CUM_DIST_MT[i + 1] - CUM_DIST_MT[i];

  const f =
    segLen > 0
      ? (clamped - CUM_DIST_MT[i]) / segLen
      : 0;

  const a = ALL_COORDS[i];

  const b =
    ALL_COORDS[
      Math.min(i + 1, ALL_COORDS.length - 1)
    ];

  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
  ];
};

export const bearingBetween = (
  a: [number, number],
  b: [number, number]
): number => {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;

  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);

  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) *
      Math.cos(φ2) *
      Math.cos(Δλ);

  return (Math.atan2(y, x) * 180) / Math.PI;
};