import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { FirefighterStatus, Rank } from "../../generated/prisma/client.js";
import { UpdateFirefighterService } from "../../services/firefighter/update-firefighter-service.js";
import { handleError } from "../../errors/handle-error.js";
import { BadRequestError } from "../../errors/index.js";

export class UpdateFirefighterController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    const bodySchema = z.object({
      name: z.string().min(2).max(128).optional(),
      war_name: z.string().min(2).max(64).optional(),
      rank: z.enum(Rank).optional(),
      status: z.enum(FirefighterStatus).optional(),
      phone: z.string().min(10).max(15).optional(),
      email: z.email().nullable().optional(),
      unit_id: z.uuid().optional()
    })

    try {
      const { id } = paramsSchema.parse(req.params)
      const body = bodySchema.parse(req.body)

      if (Object.keys(body).length === 0) {
        throw new BadRequestError("At least one field must be provided for update")
      }

      const updateFirefighterService = new UpdateFirefighterService()
      const firefighter = await updateFirefighterService.execute({ id, ...body })

      return rep.status(200).send({ message: "Firefighter updated successfully", firefighter })
    } catch (error: unknown) {
      return handleError(error, rep, "Firefighter")
    }
  }
}
