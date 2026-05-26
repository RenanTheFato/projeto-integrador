import { Base } from "@prisma/client";
import { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod/v4";
import { SearchBaseByNameService } from "../../services/base/search-base-by-name-service.js";
import { NotFoundError } from "../../errors/index.js";

export class SeacrhBaseByNameController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const searchParamsSchema = z.object({
      name: z.string({ error: "The value must be an string for name or query param is missing" })
        .min(2, { error: "The name doesn't meet the minimum number of characters (2)" })
        .max(128, { error: "The name has exceeded the character limit (128)." }),
    })

    try {
      searchParamsSchema.parse(req.query)
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

    const { name } = req.query as z.infer<typeof searchParamsSchema>

    try {
      const searchBaseByNameService = new SearchBaseByNameService()
      const bases = await searchBaseByNameService.execute({ name })

      return rep.status(200).send({ message: "Bases found in relation to the name", bases })
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        return rep.status(404).send({ error: error.message })
      }

      console.error(error)
      return rep.status(500).send({ error: "Internal Server Error" })
    }

  }
}