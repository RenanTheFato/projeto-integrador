import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { CrewRole } from "../../generated/prisma/client.js";
import { CreateCrewService } from "../../services/crew/create-crew-service.js";
import { handleError } from "../../errors/handle-error.js";

export class CreateCrewController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const crewSchema = z.object({
      name: z.string({ error: "The value must be a string for name" })
        .min(2, { error: "The name doesn't meet the minimum number of characters (2)" })
        .max(64, { error: "The name has exceeded the character limit (64)." }),

      vehicle_id: z.uuid({ error: "The vehicle_id must be a valid uuid" }),
      unit_id: z.uuid({ error: "The unit_id must be a valid uuid" }),
      commander_id: z.uuid({ error: "The commander_id must be a valid uuid" }).optional(),

      started_at: z.coerce.date({ error: "The started_at must be a valid date" }),
      ended_at: z.coerce.date({ error: "The ended_at must be a valid date" }).optional(),

      members: z.array(
        z.object({
          firefighter_id: z.uuid({ error: "The firefighter_id must be a valid uuid" }),
          role: z.enum(CrewRole, { error: "The role must be COMANDANTE, MOTORISTA, COMBATENTE or SOCORRISTA" })
        }),
        { error: "The members must be an array" }
      ).min(1, { error: "A crew needs at least one member" })
    })

    try {
      const data = crewSchema.parse(req.body)

      const createCrewService = new CreateCrewService()
      const crew = await createCrewService.execute(data)

      return rep.status(201).send({ message: "Crew created successfully", crew })
    } catch (error: unknown) {
      return handleError(error, rep, "Crew")
    }
  }
}
