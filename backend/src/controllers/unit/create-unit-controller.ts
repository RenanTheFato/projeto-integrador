import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { UnitType } from "../../generated/prisma/client.js";
import { CreateUnitService } from "../../services/unit/create-unit-service.js";
import { handleError } from "../../errors/handle-error.js";

export class CreateUnitController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const unitSchema = z.object({
      name: z.string({ error: "The value must be a string for name" })
        .min(2, { error: "The name doesn't meet the minimum number of characters (2)" })
        .max(128, { error: "The name has exceeded the character limit (128)." }),

      acronym: z.string({ error: "The value must be a string for acronym" })
        .min(2, { error: "The acronym doesn't meet the minimum number of characters (2)" })
        .max(16, { error: "The acronym has exceeded the character limit (16)." }),

      type: z.enum(UnitType, { error: "The type must be COMANDO_GERAL, COMANDO_REGIONAL, GRUPAMENTO, SUBGRUPAMENTO or POSTO" }),

      address: z.string({ error: "The value must be a string for address" })
        .min(2, { error: "The address doesn't meet the minimum number of characters (2)" })
        .max(128, { error: "The address has exceeded the character limit (128)." }),

      latitude: z.coerce.number({ error: "The value must be a valid coordinate number for latitude" })
        .min(-90, { error: "The latitude cannot be less than -90 degrees." })
        .max(90, { error: "The latitude cannot be greater than 90 degrees." }),

      longitude: z.coerce.number({ error: "The value must be a valid coordinate number for longitude" })
        .min(-180, { error: "The longitude cannot be less than -180 degrees." })
        .max(180, { error: "The longitude cannot be greater than 180 degrees." }),

      phone: z.string({ error: "The value must be a string for phone" })
        .min(10, { error: "The phone number doesn't meet the minimum number of characters (10)." })
        .max(15, { error: "The phone number has exceeded the character limit (15)." }),

      parent_id: z.uuid({ error: "The parent_id must be a valid uuid" }).optional()
    })

    try {
      const data = unitSchema.parse(req.body)

      const createUnitService = new CreateUnitService()
      const unit = await createUnitService.execute(data)

      return rep.status(201).send({ message: "Unit created successfully", unit })
    } catch (error: unknown) {
      return handleError(error, rep, "Unit")
    }
  }
}
