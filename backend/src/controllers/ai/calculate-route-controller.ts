import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { CalculateRouteService } from "../../services/ai/calculate-route-service.js";
import { handleError } from "../../errors/handle-error.js";

export class CalculateRouteController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const routeSchema = z.object({
      origin_latitude: z.coerce.number().min(-90).max(90).optional(),
      origin_longitude: z.coerce.number().min(-180).max(180).optional(),
      origin_unit_id: z.uuid({ error: "The origin_unit_id must be a valid uuid" }).optional(),

      destination_latitude: z.coerce.number({ error: "The destination_latitude is required" }).min(-90).max(90),
      destination_longitude: z.coerce.number({ error: "The destination_longitude is required" }).min(-180).max(180),

      dispatch_id: z.uuid({ error: "The dispatch_id must be a valid uuid" }).optional()
    }).refine(
      (data) => data.origin_unit_id !== undefined || (data.origin_latitude !== undefined && data.origin_longitude !== undefined),
      { error: "Provide either origin_unit_id or both origin_latitude and origin_longitude" }
    )

    try {
      const data = routeSchema.parse(req.body)

      const calculateRouteService = new CalculateRouteService()
      const result = await calculateRouteService.execute(data)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Route")
    }
  }
}
