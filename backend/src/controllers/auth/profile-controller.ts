import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";
import { handleError } from "../../errors/handle-error.js";

/// Devolve o usuario autenticado junto do militar vinculado e da unidade dele,
/// que e o que o front precisa para montar o contexto da sessao.
export class ProfileController {
  async handle(req: FastifyRequest, rep: FastifyReply) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        omit: { password_hash: true },
        include: {
          firefighter: {
            include: {
              unit: {
                select: { id: true, name: true, acronym: true, type: true }
              }
            }
          }
        }
      })

      if (!user) {
        throw new NotFoundError("User not found")
      }

      return rep.status(200).send({ user })
    } catch (error: unknown) {
      return handleError(error, rep, "Profile")
    }
  }
}
