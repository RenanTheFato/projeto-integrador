import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { DeleteShiftService } from "../../services/shift/delete-shift-service.js";
import { handleError } from "../../errors/handle-error.js";

export class DeleteShiftController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const deleteShiftService = new DeleteShiftService()
      await deleteShiftService.execute(id)

      return rep.status(204).send()
    } catch (error: unknown) {
      return handleError(error, rep, "Shift")
    }
  }
}
