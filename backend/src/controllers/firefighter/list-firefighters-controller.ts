import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { FirefighterStatus, Rank } from "../../generated/prisma/client.js";
import { ListFirefightersService } from "../../services/firefighter/list-firefighters-service.js";
import { handleError } from "../../errors/handle-error.js";

export class ListFirefightersController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" }).optional(),
      rank: z.enum(Rank).optional(),
      status: z.enum(FirefighterStatus).optional(),
      search: z.string().max(128).optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listFirefightersService = new ListFirefightersService()
      const result = await listFirefightersService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Firefighter")
    }
  }
}
