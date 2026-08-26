/** Formatting shared by every screen, so a duration reads the same everywhere. */

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
})

const DATE_ONLY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
})

const SHORT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
})

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME.format(date)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : DATE_ONLY.format(date)
}

export function formatShort(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : SHORT.format(date)
}

/** Seconds as `8:43 min`, the shape the first version of the screens used. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—"

  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60

  if (minutes === 0) return `${rest} s`
  return `${minutes}:${String(rest).padStart(2, "0")} min`
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return "—"
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2).replace(".", ",")} km`
}

/** Prisma sends Decimal as a string; the map and the maths need a number. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatCoordinate(value: string | number | null | undefined): string {
  const parsed = toNumber(value)
  return parsed === null ? "—" : parsed.toFixed(6)
}

/** "há 4 min" — how long an incident has been open. */
export function formatElapsed(from: string | null | undefined): string {
  if (!from) return "—"

  const start = new Date(from).getTime()
  if (Number.isNaN(start)) return "—"

  const seconds = Math.max(0, Math.round((Date.now() - start) / 1000))

  if (seconds < 60) return "agora há pouco"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`

  const days = Math.floor(hours / 24)
  return `há ${days} dia${days === 1 ? "" : "s"}`
}

/** Formats the input a `datetime-local` field expects from an ISO string. */
export function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
