import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { ListCrewsService } from "../../services/crew/list-crews-service.js";
import { handleError } from "../../errors/handle-error.js";

export class ListCrewsController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      unit_id: z.uuid().optional(),
      vehicle_id: z.uuid().optional(),
      active: z.stringbool().optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listCrewsService = new ListCrewsService()
      const result = await listCrewsService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Crew")
    }
  }
}
