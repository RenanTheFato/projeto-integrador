import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateCrewController } from "../controllers/crew/create-crew-controller.js";
import { ListCrewsController } from "../controllers/crew/list-crews-controller.js";
import { GetCrewController } from "../controllers/crew/get-crew-controller.js";
import { UpdateCrewController } from "../controllers/crew/update-crew-controller.js";
import { DeleteCrewController } from "../controllers/crew/delete-crew-controller.js";

export async function crewRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListCrewsController().handle(req, rep)
  })

  fastify.get("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetCrewController().handle(req, rep)
  })

  fastify.post("/", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateCrewController().handle(req, rep)
  })

  fastify.patch("/:id", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateCrewController().handle(req, rep)
  })

  fastify.delete("/:id", { onRequest: [fastify.authorize(["ADMIN"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new DeleteCrewController().handle(req, rep)
  })
}
