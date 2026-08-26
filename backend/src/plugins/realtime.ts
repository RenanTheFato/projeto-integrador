import { fastifyWebsocket } from "@fastify/websocket";
import { FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { TokenPayload } from "../@types/fastify-types.js";
import { eventHub } from "../realtime/event-hub.js";

/// Exposes GET /realtime as a WebSocket endpoint that streams dispatch events.
///
/// Browsers cannot set headers on a WebSocket handshake, so the token is read
/// from the `token` query string or from the httpOnly cookie instead of the
/// Authorization header.
///
/// Unlike the auth plugin, this one must NOT be wrapped in `fastify-plugin`:
/// breaking encapsulation would also discard the `prefix` option it is
/// registered with, and the socket would end up at /realtime instead of
/// /api/v1/realtime. It decorates nothing, so encapsulation costs it nothing.
/// It still needs `fastify.jwt`, which the auth plugin puts on the root
/// instance and is therefore visible here — provided server.ts keeps
/// registering auth first.
export async function realtimePlugin(fastify: FastifyTypedInstance) {

  await fastify.register(fastifyWebsocket)

  fastify.get("/realtime", { websocket: true }, (socket, req: FastifyRequest) => {
    const { token } = req.query as { token?: string }

    let payload: TokenPayload

    try {
      payload = token
        ? fastify.jwt.verify<TokenPayload>(token)
        : fastify.jwt.verify<TokenPayload>(req.cookies.token ?? "")
    } catch {
      socket.send(JSON.stringify({ type: "error", payload: { message: "Missing or invalid authentication token" } }))
      socket.close(1008, "unauthorized")
      return
    }

    const subscriber = { socket, user_id: payload.sub, role: payload.role }
    eventHub.add(subscriber)

    socket.send(JSON.stringify({ type: "connected", payload: { user_id: payload.sub, role: payload.role } }))

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
