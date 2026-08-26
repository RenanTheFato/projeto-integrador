import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetOccurrenceService } from "../../services/occurrence/get-occurrence-service.js";
import { handleError } from "../../errors/handle-error.js";

export class GetOccurrenceController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getOccurrenceService = new GetOccurrenceService()
      const occurrence = await getOccurrenceService.execute(id)

      return rep.status(200).send({ occurrence })
    } catch (error: unknown) {
      return handleError(error, rep, "Occurrence")
    }
  }
}
