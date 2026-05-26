import { Decimal } from "@prisma/client/runtime/client";
import { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod/v4";
import { CreateBaseService } from "../../services/base/create-base-service.js";
import { BadRequestError } from "../../errors/index.js";

export class CreateBaseController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const baseSchema = z.object({
      name: z.string({ error: "The value must be an string for name" })
        .min(2, { error: "The name doesn't meet the minimum number of characters (2)" })
        .max(128, { error: "The name has exceeded the character limit (128)." }),

      address: z.string({ error: "The value must be an string for address" })
        .min(2, ({ error: "The address doesn't meet the minimum number of characters (2)" }))
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
    })

    try {
      baseSchema.parse(req.body)
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          code: err.code,
          message: err.message,
          path: err.path.join("/")
        }))
        return rep.status(400).send({ error: "Base Validation Error Occurred", errors })
      }
    }

    const { name, address, latitude, longitude, phone } = req.body as z.infer<typeof baseSchema>

    const latitudeDecimal = new Decimal(latitude)
    const longitudeDecimal = new Decimal(longitude)

    try {
      const createBaseService = new CreateBaseService()
      const base = await createBaseService.execute({ name, address, latitude: latitudeDecimal, longitude: longitudeDecimal, phone })

      return rep.status(201).send({ message: "Base created successfully", base })
    } catch (error: unknown) {
      if (error instanceof BadRequestError) {
        return rep.status(400).send({ error: error.message })
      }

      console.error(error)
      return rep.status(500).send({ error: "Internal Server Error" })
    }
  }
}