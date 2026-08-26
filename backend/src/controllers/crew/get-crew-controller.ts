import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetCrewService } from "../../services/crew/get-crew-service.js";
import { handleError } from "../../errors/handle-error.js";

export class GetCrewController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getCrewService = new GetCrewService()
      const crew = await getCrewService.execute(id)

      return rep.status(200).send({ crew })
    } catch (error: unknown) {
      return handleError(error, rep, "Crew")
    }
  }
}
