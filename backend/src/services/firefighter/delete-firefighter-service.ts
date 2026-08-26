import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";

export class DeleteFirefighterService {
  async execute(id: string): Promise<void> {

    const firefighter = await prisma.firefighter.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { crew_members: true, shifts: true, commanded_crews: true } },
        user: { select: { id: true } }
      }
    })

    if (!firefighter) {
      throw new NotFoundError("Firefighter not found")
    }

    // Personnel history must survive; discharging is a status change, not a
    // deletion. Only records with no operational trace can be removed.
    const links = Object.entries(firefighter._count)
      .filter(([, count]) => count > 0)
      .map(([relation, count]) => `${relation}: ${count}`)

    if (firefighter.user) {
      links.push("user account")
    }

    if (links.length > 0) {
      throw new ConflictError(`Firefighter still has linked records (${links.join(", ")}). Set status to INATIVO instead of deleting.`)
    }

    await prisma.firefighter.delete({ where: { id } })
  }
}
