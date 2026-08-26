import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetUnitService } from "../../services/unit/get-unit-service.js";
import { handleError } from "../../errors/handle-error.js";

export class GetUnitController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getUnitService = new GetUnitService()
      const unit = await getUnitService.execute(id)

      return rep.status(200).send({ unit })
    } catch (error: unknown) {
      return handleError(error, rep, "Unit")
    }
  }
}
