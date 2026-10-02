/** One simulation clock preserves the relative arrival times of every route. */
export function comparisonProgress(elapsedMs: number, durationMs: number, seconds: number[]): number[] {
  const valid = seconds.map((value) => Number.isFinite(value) && value > 0 ? value : 1)
  const simulated = Math.max(0, elapsedMs) / Math.max(1, durationMs) * Math.max(...valid, 1)
  return valid.map((value) => Math.min(1, simulated / value))
}

/** Different entry/exit thresholds prevent flicker near the split boundary. */
export function nextCameraLayout(split: boolean, fittedZoom: number): boolean {
  return split ? fittedZoom < 16.35 : fittedZoom < 15.65
}
