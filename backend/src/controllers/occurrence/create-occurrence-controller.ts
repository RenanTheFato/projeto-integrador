import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { OccurrenceNature, OccurrencePriority } from "../../generated/prisma/client.js";
import { CreateOccurrenceService } from "../../services/occurrence/create-occurrence-service.js";
import { handleError } from "../../errors/handle-error.js";

export class CreateOccurrenceController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const occurrenceSchema = z.object({
      nature: z.enum(OccurrenceNature, { error: "The nature must be a valid occurrence type" }),

      priority: z.enum(OccurrencePriority, { error: "The priority must be BAIXA, MEDIA, ALTA or CRITICA" })
        .default("MEDIA"),

      description: z.string({ error: "The value must be a string for description" })
        .min(5, { error: "The description doesn't meet the minimum number of characters (5)" })
        .max(1024, { error: "The description has exceeded the character limit (1024)." }),

      address: z.string({ error: "The value must be a string for address" })
        .min(5, { error: "The address doesn't meet the minimum number of characters (5)" })
        .max(256, { error: "The address has exceeded the character limit (256)." }),

      latitude: z.coerce.number({ error: "The value must be a valid coordinate number for latitude" })
        .min(-90, { error: "The latitude cannot be less than -90 degrees." })
        .max(90, { error: "The latitude cannot be greater than 90 degrees." }),

      longitude: z.coerce.number({ error: "The value must be a valid coordinate number for longitude" })
        .min(-180, { error: "The longitude cannot be less than -180 degrees." })
        .max(180, { error: "The longitude cannot be greater than 180 degrees." }),

      caller_name: z.string().max(128).optional(),
      caller_phone: z.string().min(8).max(15).optional(),

      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" })
    })

    try {
      const data = occurrenceSchema.parse(req.body)

      const createOccurrenceService = new CreateOccurrenceService()
      const occurrence = await createOccurrenceService.execute(data)

      return rep.status(201).send({ message: "Occurrence created successfully", occurrence })
    } catch (error: unknown) {
      return handleError(error, rep, "Occurrence")
    }
  }
}
