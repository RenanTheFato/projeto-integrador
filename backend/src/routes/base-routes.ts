import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateBaseController } from "../controllers/base/create-base-controller.js";

export async function baseRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {
  fastify.post("/create", async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateBaseController().handle(req, rep)
  })
}