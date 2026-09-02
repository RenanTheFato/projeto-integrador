/**
 * The charts the statistics screen is built from.
 *
 * All of them plot one series — a count — so all of them use one hue and let
 * length carry the magnitude. Colouring each bar by its own value would encode
 * the same number twice and spend the only free channel on nothing.
 *
 * `Ranking` is deliberately HTML rather than SVG: the categories are addresses
 * and incident names, which wrap, and text that wraps is something the browser
 * does far better than a hand-laid-out `<text>` element.
 */

import { useState } from "react"

import { useMeasure } from "@/hooks/use-measure"

const BAR_COLOR = "#0B63A5"
const GRID_COLOR = "#E4E9EF"
const AXIS_INK = "#8496A5"

// -- ranking -----------------------------------------------------------------

export interface RankingItem {
  key: string
  label: string
  value: number
  /** Shown under the label, e.g. how many of these were closed. */
  note?: string
}

export function Ranking({ items, emptyMessage, unit = "ocorrências" }: {
  items: RankingItem[]
  emptyMessage: string
  unit?: string
}) {
  if (items.length === 0) {
    return <p className="text-ink-muted">{emptyMessage}</p>
  }

  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-ink">
              <span className="mr-2 text-sm font-semibold text-ink-soft">{index + 1}</span>
              {item.label}
            </span>
            <strong
              className="shrink-0 font-semibold text-ink"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {item.value}
            </strong>
          </div>

          {/* 10px is well under the 24px cap, and the bar grows from a single
              baseline at the left edge. */}
          <div
            className="h-2.5 rounded-r-[4px]"
            style={{
              width: `${Math.max(2, (item.value / max) * 100)}%`,
              background: BAR_COLOR,
            }}
            role="img"
            aria-label={`${item.label}: ${item.value} ${unit}`}
          />

          {item.note && <span className="text-sm text-ink-soft">{item.note}</span>}
        </li>
      ))}
    </ol>
  )
}

// -- hour histogram ----------------------------------------------------------

const HISTOGRAM_HEIGHT = 190
const PADDING = { top: 18, right: 8, bottom: 26, left: 34 }

/**
 * Calls by hour of the day.
 *
 * Twenty-four columns is past the point where a legend or per-column labels
 * help, so the axis is labelled every three hours and the exact number lives in
 * the hover readout and in the accessible label on the chart.
 */
export function HourHistogram({ counts }: { counts: number[] }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<number | null>(null)

  const total = counts.reduce((sum, value) => sum + value, 0)

  if (total === 0) {
    return <p className="text-ink-muted">Nenhuma ocorrência no período filtrado.</p>
  }

  const max = Math.max(...counts, 1)
  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right)
  const plotHeight = HISTOGRAM_HEIGHT - PADDING.top - PADDING.bottom

  const slot = plotWidth / 24
  const barWidth = Math.min(24, Math.max(4, slot - 4))
  const y = (value: number) => PADDING.top + plotHeight - (value / max) * plotHeight

  const busiest = counts.indexOf(max)

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={HISTOGRAM_HEIGHT}
          role="img"
          aria-label={`Ocorrências por hora do dia. Pico às ${busiest} horas, com ${max} ocorrências.`}
        >
          {[0, max / 2, max].map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left} y1={y(tick)} x2={width - PADDING.right} y2={y(tick)}
                stroke={GRID_COLOR} strokeWidth={1}
              />
              <text
                x={PADDING.left - 6} y={y(tick) + 4}
                textAnchor="end" fontSize={11} fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(tick)}
              </text>
            </g>
          ))}

          {counts.map((value, hour) => {
            const centre = PADDING.left + slot * hour + slot / 2
            const top = y(value)

            return (
              <g key={hour}>
                <rect
                  x={centre - barWidth / 2} y={top}
                  width={barWidth} height={Math.max(0, PADDING.top + plotHeight - top)}
                  fill={BAR_COLOR}
                  opacity={hover === null || hover === hour ? 1 : 0.6}
                  rx={3}
                />

                {hour % 3 === 0 && (
                  <text
                    x={centre} y={HISTOGRAM_HEIGHT - 8}
                    textAnchor="middle" fontSize={10} fill={AXIS_INK}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {hour}h
                  </text>
                )}

                {/* The column, not the bar, is the hit target. */}
                <rect
                  x={PADDING.left + slot * hour} y={PADDING.top}
                  width={slot} height={plotHeight}
                  fill="transparent"
                  onPointerEnter={() => setHover(hour)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            )
          })}
        </svg>
      )}

      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 border border-line bg-surface px-2.5 py-1.5 shadow-lg"
          style={{
            left: Math.min(
              Math.max(PADDING.left + slot * hover + slot / 2 - 60, 0),
              Math.max(width - 120, 0),
            ),
          }}
        >
          <p className="whitespace-nowrap text-sm">
            <strong
              className="font-semibold text-ink"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {counts[hover]}
            </strong>{" "}
            <span className="text-ink-soft">
              entre {String(hover).padStart(2, "0")}h e {String(hover).padStart(2, "0")}h59
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// -- time series -------------------------------------------------------------

export interface SeriesPoint {
  label: string
  value: number
}

const SERIES_HEIGHT = 230
const SERIES_PADDING = { top: 16, right: 14, bottom: 28, left: 40 }

/**
 * A count over time, optionally against the period before it.
 *
 * Both lines share one axis because they are the same measure — calls per
 * bucket — which is the only honest way to put two series on one plot. The
 * earlier period is dashed and grey: it is context for the current line, not a
 * peer of it.
 */
export function TimeSeries({ current, previous, currentLabel, previousLabel }: {
  current: SeriesPoint[]
  previous?: SeriesPoint[]
  currentLabel: string
  previousLabel?: string
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<number | null>(null)

  if (current.length < 2) {
    return <p className="text-ink-muted">Período curto demais para desenhar uma série.</p>
  }

  const plotWidth = Math.max(0, width - SERIES_PADDING.left - SERIES_PADDING.right)
  const plotHeight = SERIES_HEIGHT - SERIES_PADDING.top - SERIES_PADDING.bottom

  const max = Math.max(
    ...current.map((point) => point.value),
    ...(previous ?? []).map((point) => point.value),
    1,
  ) * 1.1

  const x = (index: number) => SERIES_PADDING.left + (index / (current.length - 1)) * plotWidth
  const y = (value: number) => SERIES_PADDING.top + plotHeight - (value / max) * plotHeight

  const pathOf = (points: SeriesPoint[]) => points
    .map((point, index) => (index === 0 ? "M" : "L") + x(index).toFixed(1) + "," + y(point.value).toFixed(1))
    .join(" ")

  const areaOf = (points: SeriesPoint[]) =>
    pathOf(points)
    + " L" + x(points.length - 1).toFixed(1) + "," + y(0).toFixed(1)
    + " L" + x(0).toFixed(1) + "," + y(0).toFixed(1) + " Z"

  // Labelling every bucket would be a wall of dates; four anchors are enough to
  // read the axis, and the tooltip carries the rest.
  const labelAt = new Set([
    0,
    Math.floor(current.length / 3),
    Math.floor((current.length * 2) / 3),
    current.length - 1,
  ])

  return (
    <div className="flex flex-col gap-3">
      <Legend items={[
        { color: BAR_COLOR, label: currentLabel },
        ...(previous && previousLabel
          ? [{ color: CONTEXT_COLOR, label: previousLabel, dashed: true }]
          : []),
      ]} />

      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={SERIES_HEIGHT}
            role="img"
            aria-label={"Série de " + currentLabel + " ao longo do período"}
          >
            {[0, max / 2, max].map((tick) => (
              <g key={tick}>
                <line
                  x1={SERIES_PADDING.left} y1={y(tick)} x2={width - SERIES_PADDING.right} y2={y(tick)}
                  stroke={GRID_COLOR} strokeWidth={1}
                />
                <text
                  x={SERIES_PADDING.left - 6} y={y(tick) + 4}
                  textAnchor="end" fontSize={11} fill={AXIS_INK}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {Math.round(tick)}
                </text>
              </g>
            ))}

            {previous && previous.length === current.length && (
              <path
                d={pathOf(previous)}
                fill="none" stroke={CONTEXT_COLOR} strokeWidth={2}
                strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round"
              />
            )}

            <path d={areaOf(current)} fill={BAR_COLOR} opacity={0.1} />
            <path
              d={pathOf(current)}
              fill="none" stroke={BAR_COLOR} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />

            {current.map((point, index) => labelAt.has(index) && (
              <text
                key={point.label}
                x={x(index)} y={SERIES_HEIGHT - 8}
                textAnchor={index === 0 ? "start" : index === current.length - 1 ? "end" : "middle"}
                fontSize={10} fill={AXIS_INK}
              >
                {point.label}
              </text>
            ))}

            {hover !== null && (
              <g>
                <line
                  x1={x(hover)} y1={SERIES_PADDING.top}
                  x2={x(hover)} y2={SERIES_PADDING.top + plotHeight}
                  stroke={AXIS_INK} strokeWidth={1}
                />
                <circle
                  cx={x(hover)} cy={y(current[hover].value)} r={4.5}
                  fill={BAR_COLOR} stroke={SURFACE} strokeWidth={2}
                />
                {previous && previous[hover] && (
                  <circle
                    cx={x(hover)} cy={y(previous[hover].value)} r={4}
                    fill={CONTEXT_COLOR} stroke={SURFACE} strokeWidth={2}
                  />
                )}
              </g>
            )}

            <rect
              x={SERIES_PADDING.left} y={SERIES_PADDING.top}
              width={plotWidth} height={plotHeight}
              fill="transparent"
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                const ratio = (event.clientX - box.left) / (box.width || 1)
                setHover(Math.max(0, Math.min(
                  current.length - 1,
                  Math.round(ratio * (current.length - 1)),
                )))
              }}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {hover !== null && width > 0 && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 border border-line bg-surface px-3 py-2 shadow-lg"
            style={{ left: Math.min(Math.max(x(hover) - 70, 0), Math.max(width - 150, 0)) }}
          >
            <p className="text-sm text-ink-soft">{current[hover].label}</p>
            <TooltipRow color={BAR_COLOR} label={currentLabel} value={String(current[hover].value)} />
            {previous && previous[hover] && previousLabel && (
              <TooltipRow
                color={CONTEXT_COLOR}
                label={previousLabel}
                value={String(previous[hover].value)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// -- weekday x hour grid ------------------------------------------------------

/** One hue, light to dark. Density is a magnitude, so it never gets a rainbow. */
const RAMP = ["#F1F5F9", "#DCE8F2", "#A9C8E1", "#5D9BC9", "#0B63A5", "#083F6B"]

function rampColor(ratio: number): string {
  if (ratio <= 0) return RAMP[0]
  return RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.ceil(ratio * (RAMP.length - 1))))]
}

/**
 * When the calls come in, as a week laid flat.
 *
 * A histogram by hour hides that Saturday night and Tuesday night are not the
 * same night. The grid puts the two axes a shift is actually planned along —
 * day and hour — into one picture, and the darkest cells are the hours a
 * commander is really staffing for.
 */
export function HeatGrid({ rows, values }: {
  rows: string[]
  /** `values[row][hour]`, 24 hours per row. */
  values: number[][]
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<{ row: number, hour: number } | null>(null)

  const max = Math.max(...values.flat(), 1)
  const total = values.flat().reduce((sum, value) => sum + value, 0)

  if (total === 0) {
    return <p className="text-ink-muted">Nenhuma ocorrência no período filtrado.</p>
  }

  const labelWidth = 34
  const cell = Math.max(0, width - labelWidth) / 24
  const cellHeight = 26

  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} className="relative w-full overflow-hidden">
        {width > 0 && (
          <svg
            width={width}
            height={rows.length * cellHeight + 18}
            role="img"
            aria-label="Ocorrências por dia da semana e hora do dia"
          >
            {rows.map((row, rowIndex) => (
              <g key={row}>
                <text
                  x={0} y={rowIndex * cellHeight + cellHeight / 2 + 4}
                  fontSize={11} fill={AXIS_INK}
                >
                  {row}
                </text>

                {values[rowIndex].map((value, hour) => (
                  <rect
                    key={hour}
                    // The 1px inset on each side is the 2px surface gap that
                    // separates the cells; a stroke around each one would add
                    // ink that is not data.
                    x={labelWidth + hour * cell + 1}
                    y={rowIndex * cellHeight + 1}
                    width={Math.max(1, cell - 2)}
                    height={cellHeight - 2}
                    fill={rampColor(value / max)}
                    opacity={hover && (hover.row !== rowIndex || hover.hour !== hour) ? 0.75 : 1}
                    onPointerEnter={() => setHover({ row: rowIndex, hour })}
                    onPointerLeave={() => setHover(null)}
                  />
                ))}
              </g>
            ))}

            {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
              <text
                key={hour}
                x={labelWidth + hour * cell + cell / 2}
                y={rows.length * cellHeight + 13}
                textAnchor="middle" fontSize={10} fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {hour}h
              </text>
            ))}
          </svg>
        )}

        {hover && width > 0 && (
          <div
            className="pointer-events-none absolute z-10 border border-line bg-surface px-2.5 py-1.5 shadow-lg"
            style={{
              top: Math.max(0, hover.row * cellHeight - 34),
              left: Math.min(Math.max(labelWidth + hover.hour * cell - 60, 0), Math.max(width - 150, 0)),
            }}
          >
            <p className="whitespace-nowrap text-sm">
              <strong
                className="font-semibold text-ink"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {values[hover.row][hover.hour]}
              </strong>{" "}
              <span className="text-ink-soft">
                {rows[hover.row]}, {String(hover.hour).padStart(2, "0")}h
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>0</span>
        {RAMP.map((color) => (
          <span
            key={color}
            className="h-3 w-8 border border-line"
            style={{ background: color }}
          />
        ))}
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{max}</span>
        <span>ocorrências na célula</span>
      </div>
    </div>
  )
}

// -- shared pieces ------------------------------------------------------------

const CONTEXT_COLOR = "#94A3B8"
const SURFACE = "#FFFFFF"

function Legend({ items }: { items: { color: string, label: string, dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm text-ink-muted">
          <svg width="18" height="8" aria-hidden className="shrink-0">
            <line
              x1="0" y1="4" x2="18" y2="4"
              stroke={item.color} strokeWidth={item.dashed ? 2 : 2.5}
              strokeDasharray={item.dashed ? "4 3" : undefined}
              strokeLinecap="round"
            />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function TooltipRow({ color, label, value }: { color: string, label: string, value: string }) {
  return (
    <p className="flex items-center gap-2">
      <svg width="14" height="8" aria-hidden className="shrink-0">
        <line x1="0" y1="4" x2="14" y2="4" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <strong className="font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      <span className="text-sm text-ink-soft">{label}</span>
    </p>
  )
}
