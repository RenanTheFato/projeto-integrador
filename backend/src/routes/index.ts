import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";

export async function routes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {
  fastify.get("/ping", async (req: FastifyRequest, rep: FastifyReply) => {
    rep.status(200).send({
      "message": "Request Accepted",
    })
  })
}