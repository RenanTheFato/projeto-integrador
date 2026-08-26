import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetDispatchService } from "../../services/dispatch/get-dispatch-service.js";
import { handleError } from "../../errors/handle-error.js";

export class GetDispatchController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getDispatchService = new GetDispatchService()
      const dispatch = await getDispatchService.execute(id)

      return rep.status(200).send({ dispatch })
    } catch (error: unknown) {
      return handleError(error, rep, "Dispatch")
    }
  }
}
