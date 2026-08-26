import { Shift, ShiftType } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface UpdateShiftRequest {
  id: string,
  type?: ShiftType,
  start_at?: Date,
  end_at?: Date
}

export class UpdateShiftService {
  async execute({ id, type, start_at, end_at }: UpdateShiftRequest): Promise<Shift> {

    const shift = await prisma.shift.findUnique({
      where: { id },
      select: { id: true, firefighter_id: true, start_at: true, end_at: true }
    })

    if (!shift) {
      throw new NotFoundError("Shift not found")
    }

    const nextStart = start_at ?? shift.start_at
    const nextEnd = end_at ?? shift.end_at

    if (nextEnd <= nextStart) {
      throw new BadRequestError("The end_at must be later than start_at")
    }

    const overlapping = await prisma.shift.findFirst({
      where: {
        id: { not: id },
        firefighter_id: shift.firefighter_id,
        start_at: { lt: nextEnd },
        end_at: { gt: nextStart }
      },
      select: { id: true }
    })

    if (overlapping) {
      throw new ConflictError("This change would overlap another shift for the same firefighter")
    }

    return prisma.shift.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(start_at && { start_at }),
        ...(end_at && { end_at })
      }
    })
  }
}
