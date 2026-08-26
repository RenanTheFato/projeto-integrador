import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { DeleteVehicleService } from "../../services/vehicle/delete-vehicle-service.js";
import { handleError } from "../../errors/handle-error.js";

export class DeleteVehicleController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const deleteVehicleService = new DeleteVehicleService()
      await deleteVehicleService.execute(id)

      return rep.status(204).send()
    } catch (error: unknown) {
      return handleError(error, rep, "Vehicle")
    }
  }
}
