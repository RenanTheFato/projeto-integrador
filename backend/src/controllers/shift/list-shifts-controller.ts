import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { ShiftType } from "../../generated/prisma/client.js";
import { ListShiftsService } from "../../services/shift/list-shifts-service.js";
import { handleError } from "../../errors/handle-error.js";

export class ListShiftsController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      firefighter_id: z.uuid().optional(),
      unit_id: z.uuid().optional(),
      type: z.enum(ShiftType).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listShiftsService = new ListShiftsService()
      const result = await listShiftsService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Shift")
    }
  }
}
