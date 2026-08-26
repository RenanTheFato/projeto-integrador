import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { VehicleType } from "../../generated/prisma/client.js";
import { CreateVehicleService } from "../../services/vehicle/create-vehicle-service.js";
import { handleError } from "../../errors/handle-error.js";

export class CreateVehicleController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const vehicleSchema = z.object({
      prefix: z.string({ error: "The value must be a string for prefix" })
        .min(2, { error: "The prefix doesn't meet the minimum number of characters (2)" })
        .max(20, { error: "The prefix has exceeded the character limit (20)." }),

      type: z.enum(VehicleType, { error: "The type must be a valid vehicle acronym (ABT, ABTF, UR, ASE, ...)" }),

      plate: z.string({ error: "The value must be a string for plate" })
        .regex(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/, { error: "The plate must follow the Brazilian format, e.g. ABC1D23" }),

      model: z.string({ error: "The value must be a string for model" })
        .min(2, { error: "The model doesn't meet the minimum number of characters (2)" })
        .max(64, { error: "The model has exceeded the character limit (64)." }),

      year: z.coerce.number({ error: "The value must be a number for year" })
        .int({ error: "The year must be an integer" })
        .min(1950, { error: "The year cannot be earlier than 1950" })
        .max(new Date().getFullYear() + 1, { error: "The year cannot be in the future" }),

      water_capacity_liters: z.coerce.number().int().min(0).max(50000).optional(),

      crew_capacity: z.coerce.number({ error: "The value must be a number for crew_capacity" })
        .int({ error: "The crew_capacity must be an integer" })
        .min(1, { error: "The crew capacity must be at least 1" })
        .max(30, { error: "The crew capacity cannot exceed 30" }),

      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" })
    })

    try {
      const data = vehicleSchema.parse(req.body)

      const createVehicleService = new CreateVehicleService()
      const vehicle = await createVehicleService.execute(data)

      return rep.status(201).send({ message: "Vehicle created successfully", vehicle })
    } catch (error: unknown) {
      return handleError(error, rep, "Vehicle")
    }
  }
}
