import { fastifyWebsocket } from "@fastify/websocket";
import { FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { eventHub } from "../realtime/event-hub.js";

/// Exposes GET /realtime as a WebSocket endpoint that streams dispatch events.
///
/// The console is an emergency room display: it opens the socket as soon as
/// the page loads, with no handshake of its own, because a screen that has to
/// be unlocked before it shows an incident is a screen that shows it late.
///
/// This plugin must NOT be wrapped in `fastify-plugin`: breaking encapsulation
/// would also discard the `prefix` option it is registered with, and the socket
/// would end up at /realtime instead of /api/v1/realtime. It decorates nothing,
/// so encapsulation costs it nothing.
export async function realtimePlugin(fastify: FastifyTypedInstance) {

  await fastify.register(fastifyWebsocket)

  fastify.get("/realtime", { websocket: true }, (socket, _req: FastifyRequest) => {
    const subscriber = { socket }
    eventHub.add(subscriber)

    socket.send(JSON.stringify({ type: "connected", payload: {} }))

    // A ping/pong keeps proxies from dropping an idle console overnight.
    socket.on("message", (raw: Buffer) => {
      if (raw.toString() === "ping") {
        socket.send("pong")
      }
    })

    socket.on("close", () => {
      eventHub.remove(subscriber)
    })
  })
}
