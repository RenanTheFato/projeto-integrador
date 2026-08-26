import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateOccurrenceController } from "../controllers/occurrence/create-occurrence-controller.js";
import { ListOccurrencesController } from "../controllers/occurrence/list-occurrences-controller.js";
import { GetOccurrenceController } from "../controllers/occurrence/get-occurrence-controller.js";
import { UpdateOccurrenceController } from "../controllers/occurrence/update-occurrence-controller.js";

export async function occurrenceRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListOccurrencesController().handle(req, rep)
  })

  fastify.get("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetOccurrenceController().handle(req, rep)
  })

  // Opening and driving an occurrence is the dispatcher's core job.
  fastify.post("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateOccurrenceController().handle(req, rep)
  })

  fastify.patch("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateOccurrenceController().handle(req, rep)
  })

  // Occurrences are never deleted: they are the operational record. Closing or
  // cancelling happens through PATCH /:id with a status change.
}
