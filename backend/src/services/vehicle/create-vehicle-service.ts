import { Vehicle, VehicleType } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface CreateVehicleRequest {
  prefix: string,
  type: VehicleType,
  plate: string,
  model: string,
  year: number,
  water_capacity_liters?: number,
  crew_capacity: number,
  unit_id: string
}

/// Types that carry a water tank. Recording a capacity for anything else is a
/// data-entry mistake worth rejecting.
const TANK_TYPES: VehicleType[] = ["ABT", "ABTF", "ABTR", "AT"]

export class CreateVehicleService {
  async execute(data: CreateVehicleRequest): Promise<Vehicle> {

    const unit = await prisma.unit.findUnique({
      where: { id: data.unit_id },
      select: { id: true, active: true }
    })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    if (!unit.active) {
      throw new ConflictError("Cannot assign a vehicle to an inactive unit")
    }

    const duplicate = await prisma.vehicle.findFirst({
      where: {
        OR: [{ prefix: data.prefix }, { plate: data.plate }]
      },
      select: { prefix: true }
    })

    if (duplicate) {
      const field = duplicate.prefix === data.prefix ? "prefix" : "plate"
      throw new ConflictError(`A vehicle with this ${field} is already registered`)
    }

    if (data.water_capacity_liters !== undefined && !TANK_TYPES.includes(data.type)) {
      throw new BadRequestError(`A ${data.type} does not carry a water tank`)
    }

    return prisma.vehicle.create({
      data: {
        ...data,
        water_capacity_liters: data.water_capacity_liters ?? null
      }
    })
  }
}
