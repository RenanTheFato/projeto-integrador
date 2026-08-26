import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { AuthenticateUserService } from "../../services/auth/authenticate-user-service.js";
import { handleError } from "../../errors/handle-error.js";

export class AuthenticateUserController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const authenticateSchema = z.object({
      email: z.email({ error: "The value must be a valid e-mail address" }),

      password: z.string({ error: "The value must be a string for password" })
        .min(1, { error: "The password is required" })
    })

    try {
      const { email, password } = authenticateSchema.parse(req.body)

      const authenticateUserService = new AuthenticateUserService()
      const payload = await authenticateUserService.execute({ email, password })

      const token = await rep.jwtSign(payload)

      // O cookie httpOnly atende o front web; o corpo devolve o token para
      // clientes que preferem o header Authorization.
      return rep
        .setCookie("token", token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24
        })
        .status(200)
        .send({ message: "Authenticated successfully", token, user: payload })
    } catch (error: unknown) {
      return handleError(error, rep, "Authentication")
    }
  }
}
