import { FastifyReply } from "fastify";
import { ZodError } from "zod/v4";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError, UnauthorizedError } from "./index.js";

/// Traduz os erros de dominio para status HTTP. Centralizado para que os
/// controllers nao repitam a mesma cadeia de `instanceof` em cada arquivo.
export function handleError(error: unknown, rep: FastifyReply, context: string) {

  if (error instanceof ZodError) {
    const errors = error.issues.map((err) => ({
      code: err.code,
      message: err.message,
      path: err.path.join("/")
    }))
    return rep.status(400).send({ error: `${context} Validation Error Occurred`, errors })
  }

  if (error instanceof BadRequestError) {
    return rep.status(400).send({ error: error.message })
  }

  if (error instanceof UnauthorizedError) {
    return rep.status(401).send({ error: error.message })
  }

  if (error instanceof ForbiddenError) {
    return rep.status(403).send({ error: error.message })
  }

  if (error instanceof NotFoundError) {
    return rep.status(404).send({ error: error.message })
  }

  if (error instanceof ConflictError) {
    return rep.status(409).send({ error: error.message })
  }

  if (error instanceof ServiceUnavailableError) {
    return rep.status(503).send({ error: error.message })
  }

  console.error(error)
  return rep.status(500).send({ error: "Internal Server Error" })
}
