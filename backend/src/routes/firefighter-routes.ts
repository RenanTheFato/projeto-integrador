import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateFirefighterController } from "../controllers/firefighter/create-firefighter-controller.js";
import { ListFirefightersController } from "../controllers/firefighter/list-firefighters-controller.js";
import { GetFirefighterController } from "../controllers/firefighter/get-firefighter-controller.js";
import { UpdateFirefighterController } from "../controllers/firefighter/update-firefighter-controller.js";
import { DeleteFirefighterController } from "../controllers/firefighter/delete-firefighter-controller.js";

export async function firefighterRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListFirefightersController().handle(req, rep)
  })

  fastify.get("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetFirefighterController().handle(req, rep)
  })

  fastify.post("/", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateFirefighterController().handle(req, rep)
  })

  fastify.patch("/:id", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateFirefighterController().handle(req, rep)
  })

  fastify.delete("/:id", { onRequest: [fastify.authorize(["ADMIN"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new DeleteFirefighterController().handle(req, rep)
  })
}
