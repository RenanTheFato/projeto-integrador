import { Firefighter, Rank } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";

interface CreateFirefighterRequest {
  name: string,
  war_name: string,
  military_id: string,
  cpf: string,
  rank: Rank,
  phone: string,
  email?: string,
  admission_date: Date,
  unit_id: string
}

export class CreateFirefighterService {
  async execute(data: CreateFirefighterRequest): Promise<Firefighter> {

    const unit = await prisma.unit.findUnique({
      where: { id: data.unit_id },
      select: { id: true, active: true }
    })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    if (!unit.active) {
      throw new ConflictError("Cannot assign a firefighter to an inactive unit")
    }

    const duplicate = await prisma.firefighter.findFirst({
      where: {
        OR: [
          { military_id: data.military_id },
          { cpf: data.cpf },
          ...(data.email ? [{ email: data.email }] : [])
        ]
      },
      select: { military_id: true, cpf: true, email: true }
    })

    if (duplicate) {
      const field = duplicate.military_id === data.military_id ? "military_id"
        : duplicate.cpf === data.cpf ? "cpf"
        : "e-mail"
      throw new ConflictError(`A firefighter with this ${field} is already registered`)
    }

    return prisma.firefighter.create({
      data: {
        ...data,
        email: data.email ?? null
      }
    })
  }
}
