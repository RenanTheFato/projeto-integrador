import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateOccurrenceController } from "../controllers/occurrence/create-occurrence-controller.js";
import { ListOccurrencesController } from "../controllers/occurrence/list-occurrences-controller.js";
import { GetOccurrenceStatisticsController } from "../controllers/occurrence/get-occurrence-statistics-controller.js";
import { ListOperationalRecordsController } from "../controllers/occurrence/list-operational-records-controller.js";
import { GetOccurrenceController } from "../controllers/occurrence/get-occurrence-controller.js";
import { UpdateOccurrenceController } from "../controllers/occurrence/update-occurrence-controller.js";

export async function occurrenceRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListOccurrencesController().handle(req, rep)
  })

  fastify.get("/statistics", async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetOccurrenceStatisticsController().handle(req, rep)
  })

  fastify.get("/statistics/dispatches", async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListOperationalRecordsController().handle(req, rep)
  })

  fastify.get("/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetOccurrenceController().handle(req, rep)
  })

  // Opening and driving an occurrence is the dispatcher's core job.
  fastify.post("/", async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateOccurrenceController().handle(req, rep)
  })

  fastify.patch("/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateOccurrenceController().handle(req, rep)
  })

  // Occurrences are never deleted: they are the operational record. Closing or
  // cancelling happens through PATCH /:id with a status change.
}
