/**
 * Thin HTTP client for the Fastify backend.
 *
 * Every call goes through `request`, so the error shape lives in exactly one
 * place. There is no session to carry: the console is open by design, because
 * an emergency screen that asks who is looking at it is a screen that answers
 * late.
 */

const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:3333/api/v1"

export class ApiError extends Error {
  status: number
  /** Field errors from the backend's zod validation, when it sent any. */
  details?: string[]

  constructor(status: number, message: string, details?: string[]) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

function extractMessage(payload: unknown, status: number): { message: string, details?: string[] } {
  if (payload && typeof payload === "object") {
    const body = payload as { error?: unknown, message?: unknown, errors?: unknown }

    const details = Array.isArray(body.errors)
      ? body.errors.map((item) => {
          if (item && typeof item === "object") {
            const entry = item as { path?: unknown, message?: unknown }
            const path = Array.isArray(entry.path) ? entry.path.join(".") : entry.path
            return path ? `${String(path)}: ${String(entry.message)}` : String(entry.message)
          }
          return String(item)
        })
      : undefined

    const message = typeof body.error === "string"
      ? body.error
      : typeof body.message === "string" ? body.message : null

    if (message) return { message, details }
  }

  return { message: `A requisição falhou (HTTP ${status})` }
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"

  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError(0, "Não foi possível falar com o servidor. Ele está no ar?")
  }

  const text = await response.text()
  const payload: unknown = text ? safeParse(text) : null

  if (!response.ok) {
    const { message, details } = extractMessage(payload, response.status)
    throw new ApiError(response.status, message, details)
  }

  return payload as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
}

/** Builds a query string, dropping empty filters so they are not sent as "". */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }

  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

/** The WebSocket lives outside `request`, but shares the base URL. */
export function realtimeUrl(): string {
  const url = new URL(`${BASE_URL}/realtime`, window.location.origin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"

  return url.toString()
}
