import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";

export class DeleteVehicleService {
  async execute(id: string): Promise<void> {

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { crews: true, dispatches: true } }
      }
    })

    if (!vehicle) {
      throw new NotFoundError("Vehicle not found")
    }

    const links = Object.entries(vehicle._count)
      .filter(([, count]) => count > 0)
      .map(([relation, count]) => `${relation}: ${count}`)

    if (links.length > 0) {
      throw new ConflictError(`Vehicle still has linked records (${links.join(", ")}). Set status to INDISPONIVEL instead of deleting.`)
    }

    await prisma.vehicle.delete({ where: { id } })
  }
}
