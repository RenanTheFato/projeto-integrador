import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { VehicleStatus, VehicleType } from "../../generated/prisma/client.js";
import { ListVehiclesService } from "../../services/vehicle/list-vehicles-service.js";
import { handleError } from "../../errors/handle-error.js";

export class ListVehiclesController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" }).optional(),
      type: z.enum(VehicleType).optional(),
      status: z.enum(VehicleStatus).optional(),
      search: z.string().max(128).optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listVehiclesService = new ListVehiclesService()
      const result = await listVehiclesService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Vehicle")
    }
  }
}
