/**
 * The charts on the neural network screen.
 *
 * The screen used to answer "how did this run go" with three final numbers, so
 * a run that fell steadily and a run that thrashed and got lucky on the last
 * epoch looked identical, and no run could be judged against the ones before
 * it. Four charts replace that:
 *
 *  - `LossCurve` — the run's own descent, with the gap between training and
 *    validation shaded in. That gap *is* overfitting: while it stays thin the
 *    model is learning the city, and when it opens up the model is memorising
 *    the training routes instead.
 *  - `RunComparison` — every run's best validation loss against the bar the
 *    project set, oldest to newest, so a series of runs reads as progress or
 *    the lack of it.
 *  - `EpochsVsQuality` — epochs asked for against the result they bought, one
 *    dot per run, sized by how long the run took. The chart that answers "is
 *    training longer actually worth it".
 *  - `ConvergenceSpeed` — how many epochs each run needed before it first
 *    crossed the goal. Two runs can end at the same loss and one of them got
 *    there in a third of the time.
 *
 * The two curve series wear the application's own red and blue, run through the
 * palette validator against a white surface: worst adjacent separation ΔE 18.9
 * under protanopia and 32.0 for normal vision, both well over the floor.
 * Identity never rests on colour alone regardless — every chart has a legend,
 * the important points are directly labelled, and the curve's numbers are in a
 * table underneath it.
 *
 * Each SVG is drawn at measured pixel size rather than scaled from a fixed
 * viewBox, because scaling a viewBox scales the hairlines and the strokes with
 * it and the chart stops being crisp at either end of the range.
 */

import { useMemo, useState } from "react"

import type { TrainingPoint, TrainingRun } from "@/api/types"
import { formatLoss } from "@/lib/format"
import { useMeasure } from "@/hooks/use-measure"

const TRAIN_COLOR = "#DE5656"
const VALIDATION_COLOR = "#1565C0"
const CONTEXT_COLOR = "#D4D4D4"
const GRID_COLOR = "#E5E5E5"
const AXIS_INK = "#737373"
const INK = "#171717"
const SURFACE = "#FFFFFF"
const GOAL_COLOR = "#525252"

const CURVE_HEIGHT = 300
const BARS_HEIGHT = 250
const SCATTER_HEIGHT = 270
const PADDING = { top: 20, right: 18, bottom: 32, left: 58 }

/** How many earlier runs are drawn behind the selected one before it is noise. */
const CONTEXT_RUNS = 4

/** Columns past this many stop being readable and the oldest are dropped. */
const MAX_COLUMNS = 12

// -- plumbing ----------------------------------------------------------------

/**
 * The recorded progress of a run, or an empty list.
 *
 * `history` is a JSON column, so what comes back is only as trustworthy as what
 * went in: runs that finished before the column existed have null, and a
 * hand-edited row could hold anything.
 */
export function historyOf(run: TrainingRun | null | undefined): TrainingPoint[] {
  if (!run || !Array.isArray(run.history)) return []

  return run.history.filter((point): point is TrainingPoint =>
    Boolean(point) && typeof point === "object" && typeof point.epoch === "number")
}

/** Clean numbers for an axis that always starts at zero. */
function ticksUpTo(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0]
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index)
}

/** Minutes a run took, when it recorded both ends. */
function durationMinutes(run: TrainingRun): number | null {
  if (!run.started_at || !run.finished_at) return null

  const minutes = (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 60000
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

function bestOf(run: TrainingRun): number | null {
  return run.best_validation_loss ?? run.validation_loss
}

function Legend({ items }: {
  items: { color: string, label: string, dashed?: boolean, swatch?: boolean }[]
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm text-neutral-600">
          {item.swatch ? (
            <span
              className="h-3 w-4 shrink-0 border border-neutral-200"
              style={{ background: item.color, opacity: 0.35 }}
            />
          ) : (
            // A line key, not a filled box: these are lines.
            <svg width="18" height="8" aria-hidden className="shrink-0">
              <line
                x1="0" y1="4" x2="18" y2="4"
                stroke={item.color}
                strokeWidth={item.dashed ? 2 : 2.5}
                strokeDasharray={item.dashed ? "4 3" : undefined}
                strokeLinecap="round"
              />
            </svg>
          )}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ChartFrame({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption>
        <p className="font-semibold text-neutral-900">{title}</p>
        {note && <p className="text-sm text-neutral-500">{note}</p>}
      </figcaption>
      {children}
    </figure>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed border-neutral-300 bg-[#F5EFE6] px-4 py-6 text-center text-neutral-600">
      {children}
    </p>
  )
}

function TooltipRow({ color, label, value }: { color: string, label: string, value: string }) {
  return (
    <p className="flex items-center gap-2">
      <svg width="14" height="8" aria-hidden className="shrink-0">
        <line x1="0" y1="4" x2="14" y2="4" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <strong className="font-bold text-neutral-900" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      <span className="text-sm text-neutral-500">{label}</span>
    </p>
  )
}

// -- the loss curve ----------------------------------------------------------

export function LossCurve({ run, previous }: { run: TrainingRun, previous: TrainingRun[] }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<number | null>(null)

  const points = useMemo(() => historyOf(run), [run])

  const context = useMemo(
    () => previous
      .filter((other) => other.id !== run.id && historyOf(other).length > 1)
      .slice(0, CONTEXT_RUNS)
      .map((other) => ({ id: other.id, points: historyOf(other) })),
    [previous, run.id],
  )

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right)
  const plotHeight = CURVE_HEIGHT - PADDING.top - PADDING.bottom

  const maxEpoch = Math.max(
    run.epochs,
    ...points.map((point) => point.epoch),
    ...context.flatMap((other) => other.points.map((point) => point.epoch)),
    1,
  )

  const maxLoss = Math.max(
    ...points.flatMap((point) => [point.train_loss ?? 0, point.validation_loss ?? 0]),
    ...context.flatMap((other) => other.points.map((point) => point.validation_loss ?? 0)),
    0.0001,
  ) * 1.08

  const x = (epoch: number) => PADDING.left + (epoch / maxEpoch) * plotWidth
  const y = (loss: number) => PADDING.top + plotHeight - (loss / maxLoss) * plotHeight

  const pathOf = (series: TrainingPoint[], pick: (point: TrainingPoint) => number | null) => {
    let started = false

    return series.reduce((path, point) => {
      const value = pick(point)
      if (value === null || value === undefined) return path

      const command = started ? "L" : "L"
      const prefix = started ? command : "M"
      started = true
      return `${path}${prefix}${x(point.epoch).toFixed(1)},${y(value).toFixed(1)} `
    }, "").trim()
  }

  /**
   * The band between the two curves.
   *
   * Down the training line and back up the validation line, closing the shape.
   * Only the points that have both values take part — a half-open band would
   * be a lie about where the gap is.
   */
  const gapPath = useMemo(() => {
    const both = points.filter((point) =>
      point.train_loss !== null && point.validation_loss !== null)

    if (both.length < 2) return ""

    const down = both
      .map((point, index) =>
        `${index === 0 ? "M" : "L"}${x(point.epoch).toFixed(1)},${y(point.train_loss as number).toFixed(1)}`)
      .join(" ")

    const back = [...both]
      .reverse()
      .map((point) => `L${x(point.epoch).toFixed(1)},${y(point.validation_loss as number).toFixed(1)}`)
      .join(" ")

    return `${down} ${back} Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, width, maxEpoch, maxLoss])

  if (points.length === 0) {
    return (
      <ChartFrame title="Curva de perda">
        <Empty>
          Este treinamento não tem histórico gravado. O progresso passou a ser registrado época
          a época a partir de agora — dispare um treinamento para ver a curva.
        </Empty>
      </ChartFrame>
    )
  }

  const hovered = hover === null ? null : points[hover] ?? null
  const last = points[points.length - 1]

  // The epoch that produced the checkpoint that was actually kept.
  const best = points.reduce((champion, point) => {
    const value = point.validation_loss
    if (value === null) return champion
    if (!champion || value < (champion.validation_loss as number)) return point
    return champion
  }, null as TrainingPoint | null)

  const stoppedEarly = last.epoch < run.epochs
    && (run.status === "CONCLUIDO" || run.status === "FALHOU")

  return (
    <ChartFrame
      title="Curva de perda"
      note={`Uma medição a cada 50 épocas, de ${points[0].epoch} a ${last.epoch} de ${run.epochs} pedidas.`}
    >
      <Legend items={[
        { color: TRAIN_COLOR, label: "Loss de treino" },
        { color: VALIDATION_COLOR, label: "Loss de validação" },
        { color: TRAIN_COLOR, label: "Distância entre as duas", swatch: true },
        ...(context.length > 0
          ? [{ color: CONTEXT_COLOR, label: `Treinos anteriores (${context.length})` }]
          : []),
      ]} />

      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={CURVE_HEIGHT}
            role="img"
            aria-label={`Curva de perda: loss de treino e de validação ao longo de ${run.epochs} épocas`}
          >
            {ticksUpTo(maxLoss).map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left} y1={y(tick)} x2={width - PADDING.right} y2={y(tick)}
                  stroke={GRID_COLOR} strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8} y={y(tick) + 4}
                  textAnchor="end" fontSize={11} fill={AXIS_INK}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatLoss(tick)}
                </text>
              </g>
            ))}

            {[0, maxEpoch / 2, maxEpoch].map((epoch) => (
              <text
                key={epoch}
                x={x(epoch)} y={CURVE_HEIGHT - 12}
                textAnchor={epoch === 0 ? "start" : epoch === maxEpoch ? "end" : "middle"}
                fontSize={11} fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(epoch)}
              </text>
            ))}

            <text
              x={PADDING.left} y={CURVE_HEIGHT - 1}
              fontSize={10} fill={AXIS_INK}
            >
              épocas
            </text>

            {/* Where the run stopped short of what was asked for. */}
            {stoppedEarly && (
              <>
                <rect
                  x={x(last.epoch)} y={PADDING.top}
                  width={Math.max(0, x(maxEpoch) - x(last.epoch))} height={plotHeight}
                  fill="#F5EFE6" opacity={0.75}
                />
                <line
                  x1={x(last.epoch)} y1={PADDING.top}
                  x2={x(last.epoch)} y2={PADDING.top + plotHeight}
                  stroke={GOAL_COLOR} strokeWidth={1.5} strokeDasharray="3 3"
                />
              </>
            )}

            {/* Earlier runs go down first, so the current one reads on top. */}
            {context.map((other) => (
              <path
                key={other.id}
                d={pathOf(other.points, (point) => point.validation_loss)}
                fill="none" stroke={CONTEXT_COLOR} strokeWidth={1.5}
                strokeLinejoin="round" strokeLinecap="round"
              />
            ))}

            {gapPath && <path d={gapPath} fill={TRAIN_COLOR} opacity={0.14} />}

            <path
              d={pathOf(points, (point) => point.train_loss)}
              fill="none" stroke={TRAIN_COLOR} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />
            <path
              d={pathOf(points, (point) => point.validation_loss)}
              fill="none" stroke={VALIDATION_COLOR} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />

            {/* The epoch whose checkpoint was kept, labelled directly: it is
                the one point on the chart the run is judged by. */}
            {best && best.validation_loss !== null && (
              <g>
                <circle
                  cx={x(best.epoch)} cy={y(best.validation_loss)} r={5}
                  fill={VALIDATION_COLOR} stroke={SURFACE} strokeWidth={2}
                />
                <text
                  x={x(best.epoch)}
                  y={Math.max(PADDING.top + 10, y(best.validation_loss) - 12)}
                  textAnchor={x(best.epoch) > width - 90 ? "end" : "middle"}
                  fontSize={11} fontWeight={700} fill={INK}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  melhor {formatLoss(best.validation_loss)}
                </text>
              </g>
            )}

            {hovered && (
              <g>
                <line
                  x1={x(hovered.epoch)} y1={PADDING.top}
                  x2={x(hovered.epoch)} y2={PADDING.top + plotHeight}
                  stroke={AXIS_INK} strokeWidth={1}
                />
                {([
                  [hovered.train_loss, TRAIN_COLOR],
                  [hovered.validation_loss, VALIDATION_COLOR],
                ] as const).map(([value, color]) => value === null ? null : (
                  <circle
                    key={color}
                    cx={x(hovered.epoch)} cy={y(value)} r={4.5}
                    fill={color} stroke={SURFACE} strokeWidth={2}
                  />
                ))}
              </g>
            )}

            {/* The reader aims at an epoch, never at a two-pixel line, so the
                whole plot is the hit target and the nearest point wins. */}
            <rect
              x={PADDING.left} y={PADDING.top}
              width={plotWidth} height={plotHeight}
              fill="transparent"
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                const ratio = (event.clientX - box.left) / (box.width || 1)
                const epoch = ratio * maxEpoch

                let closest = 0
                points.forEach((point, index) => {
                  if (Math.abs(point.epoch - epoch) < Math.abs(points[closest].epoch - epoch)) {
                    closest = index
                  }
                })

                setHover(closest)
              }}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {hovered && width > 0 && (
          <div
            className="pointer-events-none absolute top-3 z-10 min-w-44 border border-neutral-300 bg-white px-3 py-2 shadow-lg"
            style={{ left: Math.min(Math.max(x(hovered.epoch) - 80, 0), Math.max(width - 176, 0)) }}
          >
            <p className="text-sm text-neutral-500">Época {hovered.epoch}</p>
            <TooltipRow color={TRAIN_COLOR} label="Treino" value={formatLoss(hovered.train_loss)} />
            <TooltipRow color={VALIDATION_COLOR} label="Validação" value={formatLoss(hovered.validation_loss)} />
            {hovered.train_loss !== null && hovered.validation_loss !== null && (
              <p className="mt-1 text-sm text-neutral-500">
                Distância {formatLoss(Math.abs(hovered.validation_loss - hovered.train_loss))}
              </p>
            )}
          </div>
        )}
      </div>

      {stoppedEarly && (
        <p className="text-sm text-neutral-500">
          A corrida parou na época {last.epoch} das {run.epochs} pedidas — a área clara à direita
          é o que o <em>early stopping</em> dispensou quando a loss de validação deixou de
          melhorar.
        </p>
      )}

      <details className="text-sm text-neutral-600">
        <summary className="cursor-pointer font-semibold text-neutral-700">Ver os números</summary>

        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-300 text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-1 pr-3 font-bold">Época</th>
                <th className="py-1 pr-3 font-bold">Treino</th>
                <th className="py-1 pr-3 font-bold">Validação</th>
                <th className="py-1 font-bold">Melhor</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {points.map((point) => (
                <tr key={point.epoch} className="border-b border-neutral-200">
                  <td className="py-1 pr-3">{point.epoch}</td>
                  <td className="py-1 pr-3">{formatLoss(point.train_loss)}</td>
                  <td className="py-1 pr-3">{formatLoss(point.validation_loss)}</td>
                  <td className="py-1">{formatLoss(point.best_validation_loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ChartFrame>
  )
}

// -- the run comparison ------------------------------------------------------

export function RunComparison({ runs, threshold, onSelect, selectedId }: {
  runs: TrainingRun[]
  /** The validation loss the project treats as good enough. */
  threshold: number
  onSelect?: (id: string) => void
  selectedId?: string | null
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<string | null>(null)

  // Oldest on the left: the chart is read as a timeline, and the newest run
  // arriving on the right is what makes an improvement visible as one.
  const series = useMemo(
    () => runs
      .filter((run) => bestOf(run) !== null)
      .slice(0, MAX_COLUMNS)
      .reverse()
      .map((run) => ({ run, value: bestOf(run) as number })),
    [runs],
  )

  if (series.length === 0) {
    return (
      <ChartFrame title="Melhor loss de validação por treinamento">
        <Empty>Nenhum treinamento concluído ainda — não há resultado para comparar.</Empty>
      </ChartFrame>
    )
  }

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right)
  const plotHeight = BARS_HEIGHT - PADDING.top - PADDING.bottom

  const maxLoss = Math.max(...series.map((entry) => entry.value), threshold) * 1.15
  const slot = plotWidth / series.length
  // Capped rather than filling the slot: the leftover is deliberate air.
  const barWidth = Math.min(24, Math.max(8, slot - 14))

  const y = (loss: number) => PADDING.top + plotHeight - (loss / maxLoss) * plotHeight
  const best = series.reduce((a, b) => (b.value < a.value ? b : a))

  return (
    <ChartFrame
      title="Melhor loss de validação por treinamento"
      note={`Do mais antigo ao mais recente. Quanto menor, melhor — a linha tracejada é a meta de ${formatLoss(threshold)} do projeto.`}
    >
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={BARS_HEIGHT}
            role="img"
            aria-label="Melhor loss de validação de cada treinamento, do mais antigo ao mais recente"
          >
            {ticksUpTo(maxLoss).map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left} y1={y(tick)} x2={width - PADDING.right} y2={y(tick)}
                  stroke={GRID_COLOR} strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8} y={y(tick) + 4}
                  textAnchor="end" fontSize={11} fill={AXIS_INK}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatLoss(tick)}
                </text>
              </g>
            ))}

            {series.map((entry, index) => {
              const centre = PADDING.left + slot * index + slot / 2
              const top = y(entry.value)
              const active = entry.run.id === selectedId || entry.run.id === hover

              return (
                <g key={entry.run.id}>
                  <rect
                    x={centre - barWidth / 2} y={top}
                    width={barWidth} height={PADDING.top + plotHeight - top}
                    fill={VALIDATION_COLOR}
                    opacity={active ? 1 : 0.8}
                    rx={3}
                  />

                  {entry.run.id === best.run.id && (
                    <text
                      x={centre} y={top - 7}
                      textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatLoss(entry.value)}
                    </text>
                  )}

                  <text
                    x={centre} y={BARS_HEIGHT - 12}
                    textAnchor="middle" fontSize={10} fill={AXIS_INK}
                  >
                    {shortDate(entry.run.finished_at ?? entry.run.created_at)}
                  </text>

                  {/* The hit target is the whole column, not the painted bar. */}
                  <rect
                    x={PADDING.left + slot * index} y={PADDING.top}
                    width={slot} height={plotHeight}
                    fill="transparent"
                    style={{ cursor: onSelect ? "pointer" : "default" }}
                    onPointerEnter={() => setHover(entry.run.id)}
                    onPointerLeave={() => setHover(null)}
                    onClick={() => onSelect?.(entry.run.id)}
                  />
                </g>
              )
            })}

            <line
              x1={PADDING.left} y1={y(threshold)} x2={width - PADDING.right} y2={y(threshold)}
              stroke={GOAL_COLOR} strokeWidth={2} strokeDasharray="5 4"
            />
          </svg>
        )}

        {hover && width > 0 && (() => {
          const index = series.findIndex((entry) => entry.run.id === hover)
          if (index < 0) return null

          const entry = series[index]
          const centre = PADDING.left + slot * index + slot / 2
          const minutes = durationMinutes(entry.run)

          return (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-48 border border-neutral-300 bg-white px-3 py-2 shadow-lg"
              style={{ left: Math.min(Math.max(centre - 96, 0), Math.max(width - 192, 0)) }}
            >
              <p className="text-sm text-neutral-500">
                {fullDate(entry.run.finished_at ?? entry.run.created_at)} · {entry.run.epochs} épocas
                {minutes !== null && ` · ${Math.round(minutes)} min`}
              </p>
              <TooltipRow
                color={VALIDATION_COLOR}
                label={entry.value <= threshold ? "atingiu a meta" : "acima da meta"}
                value={formatLoss(entry.value)}
              />
            </div>
          )
        })()}
      </div>

      <Legend items={[
        { color: VALIDATION_COLOR, label: "Melhor loss de validação" },
        { color: GOAL_COLOR, label: `Meta do projeto (${formatLoss(threshold)})`, dashed: true },
      ]} />
    </ChartFrame>
  )
}

// -- epochs against what they bought -----------------------------------------

/**
 * Does training longer actually help?
 *
 * Epochs asked for on one axis, the result they produced on the other, one dot
 * per run and its area growing with how long the run took. If the cloud slopes
 * down, more epochs buy a better model; if it flattens, the extra minutes are
 * being spent on nothing, and the biggest dots sitting level with the small
 * ones is that fact stated in one picture.
 */
export function EpochsVsQuality({ runs, threshold, selectedId, onSelect }: {
  runs: TrainingRun[]
  threshold: number
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<string | null>(null)

  const points = useMemo(
    () => runs.flatMap((run) => {
      const value = bestOf(run)
      if (value === null) return []

      return [{ run, value, minutes: durationMinutes(run) }]
    }),
    [runs],
  )

  if (points.length < 2) {
    return (
      <ChartFrame title="Épocas × qualidade">
        <Empty>
          São necessários pelo menos dois treinamentos concluídos para comparar o que as épocas
          compraram.
        </Empty>
      </ChartFrame>
    )
  }

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right)
  const plotHeight = SCATTER_HEIGHT - PADDING.top - PADDING.bottom

  const maxEpochs = Math.max(...points.map((point) => point.run.epochs)) * 1.1
  const maxLoss = Math.max(...points.map((point) => point.value), threshold) * 1.15
  const maxMinutes = Math.max(...points.flatMap((point) => point.minutes ?? []), 1)

  const x = (epochs: number) => PADDING.left + (epochs / maxEpochs) * plotWidth
  const y = (loss: number) => PADDING.top + plotHeight - (loss / maxLoss) * plotHeight

  // Area, not radius, carries the duration.
  const radius = (minutes: number | null) =>
    minutes === null ? 5 : 5 + Math.sqrt(minutes / maxMinutes) * 11

  return (
    <ChartFrame
      title="Épocas × qualidade"
      note="Cada bolha é um treinamento. Quanto mais à direita, mais épocas foram pedidas; quanto mais abaixo, melhor o resultado. O tamanho é o tempo que a corrida levou."
    >
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={SCATTER_HEIGHT}
            role="img"
            aria-label="Épocas pedidas contra a melhor loss de validação de cada treinamento"
          >
            {ticksUpTo(maxLoss).map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left} y1={y(tick)} x2={width - PADDING.right} y2={y(tick)}
                  stroke={GRID_COLOR} strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8} y={y(tick) + 4}
                  textAnchor="end" fontSize={11} fill={AXIS_INK}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatLoss(tick)}
                </text>
              </g>
            ))}

            {[0, maxEpochs / 2, maxEpochs].map((epochs) => (
              <text
                key={epochs}
                x={x(epochs)} y={SCATTER_HEIGHT - 12}
                textAnchor={epochs === 0 ? "start" : epochs === maxEpochs ? "end" : "middle"}
                fontSize={11} fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(epochs)}
              </text>
            ))}

            <text x={PADDING.left} y={SCATTER_HEIGHT - 1} fontSize={10} fill={AXIS_INK}>
              épocas pedidas
            </text>

            <line
              x1={PADDING.left} y1={y(threshold)} x2={width - PADDING.right} y2={y(threshold)}
              stroke={GOAL_COLOR} strokeWidth={2} strokeDasharray="5 4"
            />

            {points.map((point) => {
              const active = point.run.id === selectedId || point.run.id === hover

              return (
                <circle
                  key={point.run.id}
                  cx={x(point.run.epochs)} cy={y(point.value)}
                  r={radius(point.minutes)}
                  fill={active ? TRAIN_COLOR : VALIDATION_COLOR}
                  opacity={active ? 0.95 : 0.55}
                  stroke={SURFACE} strokeWidth={2}
                  style={{ cursor: onSelect ? "pointer" : "default" }}
                  onPointerEnter={() => setHover(point.run.id)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => onSelect?.(point.run.id)}
                />
              )
            })}
          </svg>
        )}

        {hover && width > 0 && (() => {
          const point = points.find((entry) => entry.run.id === hover)
          if (!point) return null

          return (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-48 border border-neutral-300 bg-white px-3 py-2 shadow-lg"
              style={{
                left: Math.min(Math.max(x(point.run.epochs) - 96, 0), Math.max(width - 192, 0)),
              }}
            >
              <p className="text-sm text-neutral-500">
                {fullDate(point.run.finished_at ?? point.run.created_at)}
              </p>
              <TooltipRow color={VALIDATION_COLOR} label="melhor validação" value={formatLoss(point.value)} />
              <p className="text-sm text-neutral-500">
                {point.run.epochs} épocas
                {point.minutes !== null && ` · ${Math.round(point.minutes)} min de treino`}
              </p>
            </div>
          )
        })()}
      </div>

      <Legend items={[
        { color: VALIDATION_COLOR, label: "Treinamento" },
        { color: TRAIN_COLOR, label: "Selecionado" },
        { color: GOAL_COLOR, label: `Meta do projeto (${formatLoss(threshold)})`, dashed: true },
      ]} />
    </ChartFrame>
  )
}

// -- how fast each run got there ---------------------------------------------

/**
 * Epochs spent before the goal was first cleared.
 *
 * Two runs can finish at the same loss with one of them having arrived in a
 * third of the time, and the run that arrives early is the one worth repeating
 * — it is cheaper and it leaves room to stop before overfitting. Runs that
 * never cleared the bar are shown as such rather than left out, because "it
 * never got there" is the most important thing the chart can say about them.
 */
export function ConvergenceSpeed({ runs, threshold }: {
  runs: TrainingRun[]
  threshold: number
}) {
  const entries = useMemo(
    () => runs
      .map((run) => {
        const points = historyOf(run)
        if (points.length === 0) return null

        const crossing = points.find((point) =>
          point.validation_loss !== null && point.validation_loss <= threshold)

        return {
          run,
          epoch: crossing?.epoch ?? null,
          measured: points[points.length - 1].epoch,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .slice(0, MAX_COLUMNS),
    [runs, threshold],
  )

  if (entries.length === 0) {
    return (
      <ChartFrame title="Épocas até atingir a meta">
        <Empty>
          Nenhum treinamento com histórico gravado ainda. A partir do próximo, cada corrida
          registra a época em que cruzou a meta.
        </Empty>
      </ChartFrame>
    )
  }

  const max = Math.max(...entries.map((entry) => entry.epoch ?? entry.measured), 1)

  return (
    <ChartFrame
      title="Épocas até atingir a meta"
      note={`Quantas épocas cada corrida gastou antes de cruzar ${formatLoss(threshold)} pela primeira vez. Menos é melhor.`}
    >
      <ol className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.run.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-neutral-800">
                {fullDate(entry.run.finished_at ?? entry.run.created_at)}
                <span className="ml-2 text-sm text-neutral-500">{entry.run.epochs} épocas</span>
              </span>
              <strong
                className="shrink-0 font-bold text-neutral-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {entry.epoch === null ? "não atingiu" : `${entry.epoch} épocas`}
              </strong>
            </div>

            <div
              className="h-2.5 rounded-r-[4px]"
              style={{
                width: `${Math.max(2, ((entry.epoch ?? entry.measured) / max) * 100)}%`,
                background: entry.epoch === null ? CONTEXT_COLOR : VALIDATION_COLOR,
              }}
              role="img"
              aria-label={entry.epoch === null
                ? "Não atingiu a meta"
                : `Atingiu a meta na época ${entry.epoch}`}
            />
          </li>
        ))}
      </ol>

      <Legend items={[
        { color: VALIDATION_COLOR, label: "Épocas até cruzar a meta", swatch: true },
        { color: CONTEXT_COLOR, label: "Nunca cruzou (barra é o total medido)", swatch: true },
      ]} />
    </ChartFrame>
  )
}

// -- dates --------------------------------------------------------------------

const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
const FULL_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
})

function shortDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : SHORT_DATE.format(date)
}

function fullDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : FULL_DATE.format(date)
}
