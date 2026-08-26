import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";

export class GetCrewService {
  async execute(id: string) {

    const crew = await prisma.crew.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, name: true, acronym: true } },
        vehicle: { select: { id: true, prefix: true, type: true, status: true, crew_capacity: true } },
        commander: { select: { id: true, war_name: true, rank: true } },
        members: {
          include: {
            firefighter: { select: { id: true, name: true, war_name: true, rank: true, status: true } }
          }
        }
      }
    })

    if (!crew) {
      throw new NotFoundError("Crew not found")
    }

    return crew
  }
}
