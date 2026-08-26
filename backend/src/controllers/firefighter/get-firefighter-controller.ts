import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetFirefighterService } from "../../services/firefighter/get-firefighter-service.js";
import { handleError } from "../../errors/handle-error.js";

export class GetFirefighterController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getFirefighterService = new GetFirefighterService()
      const firefighter = await getFirefighterService.execute(id)

      return rep.status(200).send({ firefighter })
    } catch (error: unknown) {
      return handleError(error, rep, "Firefighter")
    }
  }
}
