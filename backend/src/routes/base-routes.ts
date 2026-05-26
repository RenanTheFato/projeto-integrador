import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateBaseController } from "../controllers/base/create-base-controller.js";
import { SeacrhBaseByNameController } from "../controllers/base/search-base-by-name-controller.js";

export async function baseRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {
  fastify.post("/create", async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateBaseController().handle(req, rep)
  })

  fastify.get("/search", async (req: FastifyRequest, rep: FastifyReply) => {
    return new SeacrhBaseByNameController().handle(req, rep)
  })
}