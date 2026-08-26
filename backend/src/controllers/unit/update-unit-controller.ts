import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { UpdateUnitService } from "../../services/unit/update-unit-service.js";
import { handleError } from "../../errors/handle-error.js";
import { BadRequestError } from "../../errors/index.js";

export class UpdateUnitController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    const bodySchema = z.object({
      name: z.string().min(2).max(128).optional(),
      acronym: z.string().min(2).max(16).optional(),
      address: z.string().min(2).max(128).optional(),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
      phone: z.string().min(10).max(15).optional(),
      active: z.boolean().optional(),
      // null desvincula a unidade do pai atual.
      parent_id: z.uuid().nullable().optional()
    })

    try {
      const { id } = paramsSchema.parse(req.params)
      const body = bodySchema.parse(req.body)

      if (Object.keys(body).length === 0) {
        throw new BadRequestError("At least one field must be provided for update")
      }

      const updateUnitService = new UpdateUnitService()
      const unit = await updateUnitService.execute({ id, ...body })

      return rep.status(200).send({ message: "Unit updated successfully", unit })
    } catch (error: unknown) {
      return handleError(error, rep, "Unit")
    }
  }
}
