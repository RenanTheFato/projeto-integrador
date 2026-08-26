import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";

export class GetFirefighterService {
  async execute(id: string) {

    const firefighter = await prisma.firefighter.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, name: true, acronym: true, type: true } },
        user: { select: { id: true, email: true, role: true, active: true } },
        crew_members: {
          include: {
            crew: {
              select: {
                id: true, name: true, active: true,
                vehicle: { select: { id: true, prefix: true, type: true } }
              }
            }
          }
        },
        shifts: {
          where: { end_at: { gte: new Date() } },
          orderBy: { start_at: "asc" },
          take: 10
        }
      }
    })

    if (!firefighter) {
      throw new NotFoundError("Firefighter not found")
    }

    return firefighter
  }
}
