import { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "../../generated/prisma/client.js";
import { z } from "zod/v4";
import { RegisterUserService } from "../../services/auth/register-user-service.js";
import { handleError } from "../../errors/handle-error.js";

export class RegisterUserController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const registerSchema = z.object({
      email: z.email({ error: "The value must be a valid e-mail address" })
        .max(128, { error: "The e-mail has exceeded the character limit (128)." }),

      password: z.string({ error: "The value must be a string for password" })
        .min(8, { error: "The password doesn't meet the minimum number of characters (8)" })
        .max(72, { error: "The password has exceeded the character limit (72)." }),

      role: z.enum(UserRole, { error: "The role must be ADMIN, COMANDANTE or OPERADOR" }),

      firefighter_id: z.uuid({ error: "The firefighter_id must be a valid uuid" }).optional()
    })

    try {
      const { email, password, role, firefighter_id } = registerSchema.parse(req.body)

      const registerUserService = new RegisterUserService()
      const user = await registerUserService.execute({ email, password, role, firefighter_id })

      return rep.status(201).send({ message: "User created successfully", user })
    } catch (error: unknown) {
      return handleError(error, rep, "User")
    }
  }
}
