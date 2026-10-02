import { WebSocket } from "@fastify/websocket";

/// Events the dispatch console reacts to. Keeping them in one union means a
/// new event type cannot be published without being declared here first.
export type RealtimeEvent =
  | { type: "occurrence.created", payload: { id: string, protocol: string, nature: string, priority: string, address: string, latitude: string, longitude: string, unit_id: string } }
  | { type: "occurrence.updated", payload: { id: string, protocol: string, status: string } }
  | { type: "dispatch.created", payload: { id: string, occurrence_id: string, vehicle_id: string, vehicle_prefix: string, status: string } }
  | { type: "dispatch.updated", payload: { id: string, occurrence_id: string, status: string } }
  | { type: "vehicle.moved", payload: { id: string, prefix: string, latitude: string, longitude: string } }
  | { type: "occurrence.timeline", payload: { occurrence_id: string } }

interface Subscriber {
  socket: WebSocket
}

/// In-memory fan-out. Fine for a single Node process, which is what this
/// project runs. Scaling to several instances would need Redis pub/sub here.
class EventHub {
  private subscribers = new Set<Subscriber>()

  add(subscriber: Subscriber) {
    this.subscribers.add(subscriber)
  }

  remove(subscriber: Subscriber) {
    this.subscribers.delete(subscriber)
  }

  get size(): number {
    return this.subscribers.size
  }

  publish(event: RealtimeEvent) {
    const message = JSON.stringify(event)

    for (const subscriber of this.subscribers) {
      // readyState 1 is OPEN; anything else means the peer is gone and the
      // close handler simply has not fired yet.
      if (subscriber.socket.readyState === 1) {
        subscriber.socket.send(message)
      } else {
        this.subscribers.delete(subscriber)
      }
    }
  }
}

export const eventHub = new EventHub()
