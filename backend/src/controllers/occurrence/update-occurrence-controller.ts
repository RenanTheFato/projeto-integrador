import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { OccurrencePriority, OccurrenceStatus } from "../../generated/prisma/client.js";
import { UpdateOccurrenceService } from "../../services/occurrence/update-occurrence-service.js";
import { handleError } from "../../errors/handle-error.js";
import { BadRequestError } from "../../errors/index.js";

export class UpdateOccurrenceController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    const bodySchema = z.object({
      priority: z.enum(OccurrencePriority).optional(),
      status: z.enum(OccurrenceStatus).optional(),
      description: z.string().min(5).max(1024).optional(),
      address: z.string().min(5).max(256).optional()
    })

    try {
      const { id } = paramsSchema.parse(req.params)
      const body = bodySchema.parse(req.body)

      if (Object.keys(body).length === 0) {
        throw new BadRequestError("At least one field must be provided for update")
      }

      const updateOccurrenceService = new UpdateOccurrenceService()
      const occurrence = await updateOccurrenceService.execute({ id, ...body })

      return rep.status(200).send({ message: "Occurrence updated successfully", occurrence })
    } catch (error: unknown) {
      return handleError(error, rep, "Occurrence")
    }
  }
}
