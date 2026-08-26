import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";

export class DeleteShiftService {
  async execute(id: string): Promise<void> {

    const shift = await prisma.shift.findUnique({ where: { id }, select: { id: true } })

    if (!shift) {
      throw new NotFoundError("Shift not found")
    }

    await prisma.shift.delete({ where: { id } })
  }
}
