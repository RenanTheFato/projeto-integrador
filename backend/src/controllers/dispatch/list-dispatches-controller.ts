import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { DispatchStatus } from "../../generated/prisma/client.js";
import { ListDispatchesService } from "../../services/dispatch/list-dispatches-service.js";
import { handleError } from "../../errors/handle-error.js";

export class ListDispatchesController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      occurrence_id: z.uuid().optional(),
      vehicle_id: z.uuid().optional(),
      status: z.enum(DispatchStatus).optional(),
      open: z.stringbool().optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listDispatchesService = new ListDispatchesService()
      const result = await listDispatchesService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Dispatch")
    }
  }
}
