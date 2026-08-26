import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { RegisterUserController } from "../controllers/auth/register-user-controller.js";
import { AuthenticateUserController } from "../controllers/auth/authenticate-user-controller.js";
import { ProfileController } from "../controllers/auth/profile-controller.js";

export async function authRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.post("/login", async (req: FastifyRequest, rep: FastifyReply) => {
    return new AuthenticateUserController().handle(req, rep)
  })

  // Criar contas e privilegio de administrador; o primeiro admin vem do seed.
  fastify.post("/register", { onRequest: [fastify.authorize(["ADMIN"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new RegisterUserController().handle(req, rep)
  })

  fastify.get("/me", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ProfileController().handle(req, rep)
  })

  fastify.post("/logout", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return rep.clearCookie("token", { path: "/" }).status(200).send({ message: "Logged out successfully" })
  })
}
