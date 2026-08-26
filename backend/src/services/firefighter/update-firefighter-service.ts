import { Firefighter, FirefighterStatus, Rank } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";

interface UpdateFirefighterRequest {
  id: string,
  name?: string,
  war_name?: string,
  rank?: Rank,
  status?: FirefighterStatus,
  phone?: string,
  email?: string | null,
  unit_id?: string
}

export class UpdateFirefighterService {
  async execute({ id, email, unit_id, ...rest }: UpdateFirefighterRequest): Promise<Firefighter> {

    const firefighter = await prisma.firefighter.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!firefighter) {
      throw new NotFoundError("Firefighter not found")
    }

    if (unit_id) {
      const unit = await prisma.unit.findUnique({
        where: { id: unit_id },
        select: { id: true, active: true }
      })

      if (!unit) {
        throw new NotFoundError("Unit not found")
      }

      if (!unit.active) {
        throw new ConflictError("Cannot transfer a firefighter to an inactive unit")
      }
    }

    if (email) {
      const emailOwner = await prisma.firefighter.findUnique({
        where: { email },
        select: { id: true }
      })

      if (emailOwner && emailOwner.id !== id) {
        throw new ConflictError("A firefighter with this e-mail is already registered")
      }
    }

    return prisma.firefighter.update({
      where: { id },
      data: {
        ...rest,
        ...(email !== undefined && { email }),
        ...(unit_id && { unit_id })
      }
    })
  }
}
