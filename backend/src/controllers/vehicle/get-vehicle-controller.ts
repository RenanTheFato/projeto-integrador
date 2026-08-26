import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetVehicleService } from "../../services/vehicle/get-vehicle-service.js";
import { handleError } from "../../errors/handle-error.js";

export class GetVehicleController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getVehicleService = new GetVehicleService()
      const vehicle = await getVehicleService.execute(id)

      return rep.status(200).send({ vehicle })
    } catch (error: unknown) {
      return handleError(error, rep, "Vehicle")
    }
  }
}
