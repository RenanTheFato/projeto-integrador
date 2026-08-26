import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { UnitType } from "../../generated/prisma/client.js";
import { ListUnitsService } from "../../services/unit/list-units-service.js";
import { handleError } from "../../errors/handle-error.js";

export class ListUnitsController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      type: z.enum(UnitType).optional(),
      parent_id: z.uuid({ error: "The parent_id must be a valid uuid" }).optional(),
      active: z.stringbool().optional(),
      search: z.string().max(128).optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listUnitsService = new ListUnitsService()
      const result = await listUnitsService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Unit")
    }
  }
}
