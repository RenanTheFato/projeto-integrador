import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";

export class GetVehicleService {
  async execute(id: string) {

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, name: true, acronym: true, type: true } },
        crews: {
          where: { active: true },
          include: {
            commander: { select: { id: true, war_name: true, rank: true } },
            members: {
              include: {
                firefighter: { select: { id: true, war_name: true, rank: true } }
              }
            }
          }
        },
        dispatches: {
          where: { status: { notIn: ["FINALIZADO", "CANCELADO"] } },
          include: {
            occurrence: { select: { id: true, protocol: true, nature: true, address: true } }
          }
        }
      }
    })

    if (!vehicle) {
      throw new NotFoundError("Vehicle not found")
    }

    return vehicle
  }
}
