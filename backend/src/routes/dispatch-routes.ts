import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateDispatchController } from "../controllers/dispatch/create-dispatch-controller.js";
import { ListDispatchesController } from "../controllers/dispatch/list-dispatches-controller.js";
import { GetDispatchController } from "../controllers/dispatch/get-dispatch-controller.js";
import { UpdateDispatchController } from "../controllers/dispatch/update-dispatch-controller.js";

export async function dispatchRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListDispatchesController().handle(req, rep)
  })

  fastify.get("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetDispatchController().handle(req, rep)
  })

  fastify.post("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateDispatchController().handle(req, rep)
  })

  fastify.patch("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateDispatchController().handle(req, rep)
  })
}
