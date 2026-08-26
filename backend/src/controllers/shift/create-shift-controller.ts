import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { ShiftType } from "../../generated/prisma/client.js";
import { CreateShiftService } from "../../services/shift/create-shift-service.js";
import { handleError } from "../../errors/handle-error.js";

export class CreateShiftController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const shiftSchema = z.object({
      type: z.enum(ShiftType, { error: "The type must be PLANTAO_24X72, PLANTAO_12X36 or EXPEDIENTE" }),
      start_at: z.coerce.date({ error: "The start_at must be a valid date" }),
      end_at: z.coerce.date({ error: "The end_at must be a valid date" }),
      firefighter_id: z.uuid({ error: "The firefighter_id must be a valid uuid" }),
      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" })
    })

    try {
      const data = shiftSchema.parse(req.body)

      const createShiftService = new CreateShiftService()
      const shift = await createShiftService.execute(data)

      return rep.status(201).send({ message: "Shift created successfully", shift })
    } catch (error: unknown) {
      return handleError(error, rep, "Shift")
    }
  }
}
