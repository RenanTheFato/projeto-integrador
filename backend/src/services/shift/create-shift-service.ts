import { Shift, ShiftType } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface CreateShiftRequest {
  type: ShiftType,
  start_at: Date,
  end_at: Date,
  firefighter_id: string,
  unit_id: string
}

export class CreateShiftService {
  async execute({ type, start_at, end_at, firefighter_id, unit_id }: CreateShiftRequest): Promise<Shift> {

    if (end_at <= start_at) {
      throw new BadRequestError("The end_at must be later than start_at")
    }

    const firefighter = await prisma.firefighter.findUnique({
      where: { id: firefighter_id },
      select: { id: true, status: true, war_name: true }
    })

    if (!firefighter) {
      throw new NotFoundError("Firefighter not found")
    }

    if (firefighter.status !== "ATIVO") {
      throw new ConflictError(`${firefighter.war_name} is not on active duty`)
    }

    const unit = await prisma.unit.findUnique({ where: { id: unit_id }, select: { id: true } })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    // Two shifts overlap when each starts before the other ends. Scheduling a
    // firefighter in two places at once is the mistake worth catching here.
    const overlapping = await prisma.shift.findFirst({
      where: {
        firefighter_id,
        start_at: { lt: end_at },
        end_at: { gt: start_at }
      },
      select: { id: true, start_at: true, end_at: true }
    })

    if (overlapping) {
      throw new ConflictError(`This firefighter already has a shift between ${overlapping.start_at.toISOString()} and ${overlapping.end_at.toISOString()}`)
    }

    return prisma.shift.create({
      data: { type, start_at, end_at, firefighter_id, unit_id }
    })
  }
}
