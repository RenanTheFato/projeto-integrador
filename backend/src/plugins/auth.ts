import { FastifyReply, FastifyRequest } from "fastify";
import { fastifyJwt } from "@fastify/jwt";
import { UserRole } from "../generated/prisma/client.js";
import fp from "fastify-plugin";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { env } from "../config/env.js";

/// Registra o JWT e expoe dois guards reutilizaveis pelas rotas:
/// `authenticate` (exige token valido) e `authorize` (exige perfil).
///
/// Envolvido em `fastify-plugin` de proposito: sem isso as decoracoes ficariam
/// presas ao escopo deste plugin e as rotas irmas nao enxergariam os guards.
async function auth(fastify: FastifyTypedInstance) {

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN
    },
    // O token tambem e aceito via cookie httpOnly, util para o front web.
    cookie: {
      cookieName: "token",
      signed: false
    }
  })

  fastify.decorate("authenticate", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      return rep.status(401).send({ error: "Missing or invalid authentication token" })
    }
  })

  fastify.decorate("authorize", (roles: UserRole[]) => {
    return async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        await req.jwtVerify()
      } catch {
        return rep.status(401).send({ error: "Missing or invalid authentication token" })
      }

      if (!roles.includes(req.user.role)) {
        return rep.status(403).send({ error: "Your profile is not allowed to perform this action" })
      }
    }
  })
}

export const authPlugin = fp(auth, { name: "auth" })
