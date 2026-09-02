import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateCrewController } from "../controllers/crew/create-crew-controller.js";
import { ListCrewsController } from "../controllers/crew/list-crews-controller.js";
import { GetCrewController } from "../controllers/crew/get-crew-controller.js";
import { UpdateCrewController } from "../controllers/crew/update-crew-controller.js";
import { DeleteCrewController } from "../controllers/crew/delete-crew-controller.js";

export async function crewRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListCrewsController().handle(req, rep)
  })

  fastify.get("/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetCrewController().handle(req, rep)
  })

  fastify.post("/", async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateCrewController().handle(req, rep)
  })

  fastify.patch("/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateCrewController().handle(req, rep)
  })

  fastify.delete("/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    return new DeleteCrewController().handle(req, rep)
  })
}
