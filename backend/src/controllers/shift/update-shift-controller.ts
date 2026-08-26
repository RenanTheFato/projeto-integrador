import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { ShiftType } from "../../generated/prisma/client.js";
import { UpdateShiftService } from "../../services/shift/update-shift-service.js";
import { handleError } from "../../errors/handle-error.js";
import { BadRequestError } from "../../errors/index.js";

export class UpdateShiftController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    const bodySchema = z.object({
      type: z.enum(ShiftType).optional(),
      start_at: z.coerce.date().optional(),
      end_at: z.coerce.date().optional()
    })

    try {
      const { id } = paramsSchema.parse(req.params)
      const body = bodySchema.parse(req.body)

      if (Object.keys(body).length === 0) {
        throw new BadRequestError("At least one field must be provided for update")
      }

      const updateShiftService = new UpdateShiftService()
      const shift = await updateShiftService.execute({ id, ...body })

      return rep.status(200).send({ message: "Shift updated successfully", shift })
    } catch (error: unknown) {
      return handleError(error, rep, "Shift")
    }
  }
}
