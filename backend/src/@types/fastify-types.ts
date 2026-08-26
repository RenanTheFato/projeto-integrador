import { RawServerDefault, FastifyBaseLogger, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { UserRole } from "../generated/prisma/client.js";

export type FastifyTypedInstance = FastifyInstance <
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>

/// Conteudo do JWT emitido no login. Mantido enxuto de proposito: o token
/// carrega apenas o que os guards precisam, e o resto e lido do banco.
export interface TokenPayload {
  sub: string,
  email: string,
  role: UserRole
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: TokenPayload,
    user: TokenPayload
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /// Rejeita a requisicao com 401 quando nao ha um JWT valido.
    authenticate(req: FastifyRequest, rep: FastifyReply): Promise<void>,
    /// Rejeita com 403 quando o perfil do usuario nao esta na lista permitida.
    authorize(roles: UserRole[]): (req: FastifyRequest, rep: FastifyReply) => Promise<void>
  }
}
