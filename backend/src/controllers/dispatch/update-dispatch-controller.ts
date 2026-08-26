import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { DispatchStatus } from "../../generated/prisma/client.js";
import { UpdateDispatchService } from "../../services/dispatch/update-dispatch-service.js";
import { handleError } from "../../errors/handle-error.js";

export class UpdateDispatchController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    const bodySchema = z.object({
      status: z.enum(DispatchStatus, { error: "The status must be a valid dispatch stage" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)
      const { status } = bodySchema.parse(req.body)

      const updateDispatchService = new UpdateDispatchService()
      const dispatch = await updateDispatchService.execute({ id, status })

      return rep.status(200).send({ message: "Dispatch updated successfully", dispatch })
    } catch (error: unknown) {
      return handleError(error, rep, "Dispatch")
    }
  }
}
