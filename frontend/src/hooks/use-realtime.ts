/**
 * Live feed from `GET /api/v1/realtime`.
 *
 * A browser cannot set headers on a WebSocket handshake, so the JWT travels in
 * the query string — the backend accepts it there for exactly this reason.
 *
 * One socket is shared by the whole application: every screen that wants
 * events subscribes to the same connection instead of opening its own.
 */

import { useEffect, useRef, useState } from "react"

import { realtimeUrl } from "@/api/client"

export type RealtimeEvent =
  | { type: "connected", payload?: unknown }
  | { type: "occurrence.created", payload: { id: string, protocol: string, nature: string, priority: string, address: string, latitude: string, longitude: string, unit_id: string } }
  | { type: "occurrence.updated", payload: { id: string, protocol: string, status: string } }
  | { type: "dispatch.created", payload: { id: string, occurrence_id: string, vehicle_id: string, vehicle_prefix: string, status: string } }
  | { type: "dispatch.updated", payload: { id: string, occurrence_id: string, status: string } }
  | { type: "vehicle.moved", payload: { id: string, prefix: string, latitude: string, longitude: string } }

type Listener = (event: RealtimeEvent) => void

const listeners = new Set<Listener>()

let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let connected = false

const statusListeners = new Set<(value: boolean) => void>()

function setConnected(value: boolean) {
  connected = value
  statusListeners.forEach((notify) => notify(value))
}

function connect() {
  if (socket || listeners.size === 0) return

  const url = realtimeUrl()
  if (!url) return

  const ws = new WebSocket(url)
  socket = ws

  ws.addEventListener("open", () => setConnected(true))

  ws.addEventListener("message", (message) => {
    if (message.data === "pong") return

    try {
      const event = JSON.parse(message.data as string) as RealtimeEvent
      listeners.forEach((listener) => listener(event))
    } catch {
      /* frames that are not JSON are not ours */
    }
  })

  ws.addEventListener("close", () => {
    socket = null
    setConnected(false)

    // The dispatcher leaves this screen open all shift, so a dropped
    // connection has to come back on its own.
    if (listeners.size > 0 && reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connect()
      }, 3000)
    }
  })

  ws.addEventListener("error", () => ws.close())
}

function disconnectIfIdle() {
  if (listeners.size > 0) return

  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  socket?.close()
  socket = null
}

/**
 * Subscribes to the live feed. `onEvent` is kept in a ref, so passing an
 * inline callback does not tear the socket down on every render.
 */
export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  const [isConnected, setIsConnected] = useState(connected)

  useEffect(() => {
    const listener: Listener = (event) => handlerRef.current(event)

    listeners.add(listener)
    statusListeners.add(setIsConnected)
    connect()

    return () => {
      listeners.delete(listener)
      statusListeners.delete(setIsConnected)
      disconnectIfIdle()
    }
  }, [])

  return { connected: isConnected }
}
