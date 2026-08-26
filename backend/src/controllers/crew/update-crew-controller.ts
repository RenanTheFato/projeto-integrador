import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { CrewRole } from "../../generated/prisma/client.js";
import { UpdateCrewService } from "../../services/crew/update-crew-service.js";
import { handleError } from "../../errors/handle-error.js";
import { BadRequestError } from "../../errors/index.js";

export class UpdateCrewController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    const bodySchema = z.object({
      name: z.string().min(2).max(64).optional(),
      commander_id: z.uuid().nullable().optional(),
      ended_at: z.coerce.date().nullable().optional(),
      active: z.boolean().optional(),
      members: z.array(
        z.object({
          firefighter_id: z.uuid(),
          role: z.enum(CrewRole)
        })
      ).min(1, { error: "A crew needs at least one member" }).optional()
    })

    try {
      const { id } = paramsSchema.parse(req.params)
      const body = bodySchema.parse(req.body)

      if (Object.keys(body).length === 0) {
        throw new BadRequestError("At least one field must be provided for update")
      }

      const updateCrewService = new UpdateCrewService()
      const crew = await updateCrewService.execute({ id, ...body })

      return rep.status(200).send({ message: "Crew updated successfully", crew })
    } catch (error: unknown) {
      return handleError(error, rep, "Crew")
    }
  }
}
