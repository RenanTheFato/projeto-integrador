import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { Rank } from "../../generated/prisma/client.js";
import { CreateFirefighterService } from "../../services/firefighter/create-firefighter-service.js";
import { isValidCpf } from "../../utils/cpf.js";
import { handleError } from "../../errors/handle-error.js";

export class CreateFirefighterController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const firefighterSchema = z.object({
      name: z.string({ error: "The value must be a string for name" })
        .min(2, { error: "The name doesn't meet the minimum number of characters (2)" })
        .max(128, { error: "The name has exceeded the character limit (128)." }),

      war_name: z.string({ error: "The value must be a string for war_name" })
        .min(2, { error: "The war name doesn't meet the minimum number of characters (2)" })
        .max(64, { error: "The war name has exceeded the character limit (64)." }),

      military_id: z.string({ error: "The value must be a string for military_id" })
        .min(3, { error: "The military id doesn't meet the minimum number of characters (3)" })
        .max(20, { error: "The military id has exceeded the character limit (20)." }),

      cpf: z.string({ error: "The value must be a string for cpf" })
        .regex(/^\d{11}$/, { error: "The cpf must contain exactly 11 digits, without punctuation" })
        .refine(isValidCpf, { error: "The cpf check digits do not match, so this is not a valid number" }),

      rank: z.enum(Rank, { error: "The rank must be a valid post or graduation of the corporation" }),

      phone: z.string({ error: "The value must be a string for phone" })
        .min(10, { error: "The phone number doesn't meet the minimum number of characters (10)." })
        .max(15, { error: "The phone number has exceeded the character limit (15)." }),

      email: z.email({ error: "The value must be a valid e-mail address" }).optional(),

      admission_date: z.coerce.date({ error: "The admission_date must be a valid date" })
        .max(new Date(), { error: "The admission_date cannot be in the future" }),

      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" })
    })

    try {
      const data = firefighterSchema.parse(req.body)

      const createFirefighterService = new CreateFirefighterService()
      const firefighter = await createFirefighterService.execute(data)

      return rep.status(201).send({ message: "Firefighter created successfully", firefighter })
    } catch (error: unknown) {
      return handleError(error, rep, "Firefighter")
    }
  }
}
