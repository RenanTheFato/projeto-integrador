import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";

export class GetUnitService {
  async execute(id: string) {

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, acronym: true, type: true }
        },
        children: {
          select: { id: true, name: true, acronym: true, type: true, active: true }
        },
        _count: {
          select: { firefighters: true, vehicles: true, crews: true, occurrences: true }
        }
      }
    })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    return unit
  }
}
