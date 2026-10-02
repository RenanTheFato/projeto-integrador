import { Prisma, Vehicle, VehicleStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";
import { eventHub } from "../../realtime/event-hub.js";

interface UpdateVehicleRequest {
  id: string,
  prefix?: string,
  plate?: string,
  model?: string,
  year?: number,
  water_capacity_liters?: number | null,
  crew_capacity?: number,
  status?: VehicleStatus,
  current_latitude?: number,
  current_longitude?: number,
  unit_id?: string
}

export class UpdateVehicleService {
  async execute({ id, prefix, plate, current_latitude, current_longitude, unit_id, ...rest }: UpdateVehicleRequest): Promise<Vehicle> {

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { id: true, status: true }
    })

    if (!vehicle) {
      throw new NotFoundError("Vehicle not found")
    }

    if (prefix || plate) {
      const duplicate = await prisma.vehicle.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(prefix ? [{ prefix }] : []),
            ...(plate ? [{ plate }] : [])
          ]
        },
        select: { prefix: true }
      })

      if (duplicate) {
        throw new ConflictError(`A vehicle with this ${duplicate.prefix === prefix ? "prefix" : "plate"} is already registered`)
      }
    }

    // A vehicle currently assigned to an open dispatch cannot be sent to the
    // workshop without first releasing it, or the dispatch would be orphaned.
    if (rest.status && rest.status !== "EMPENHADA" && vehicle.status === "EMPENHADA") {
      const openDispatch = await prisma.dispatch.findFirst({
        where: {
          vehicle_id: id,
          status: { notIn: ["FINALIZADO", "CANCELADO"] }
        },
        select: { id: true }
      })

      if (openDispatch) {
        throw new ConflictError("This vehicle is assigned to an open dispatch. Finish or cancel it first.")
      }
    }

    if (unit_id) {
      const unit = await prisma.unit.findUnique({ where: { id: unit_id }, select: { id: true } })

      if (!unit) {
        throw new NotFoundError("Unit not found")
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...rest,
        ...(prefix && { prefix }),
        ...(plate && { plate }),
        ...(unit_id && { unit_id }),
        ...(current_latitude !== undefined && { current_latitude: new Prisma.Decimal(current_latitude) }),
        ...(current_longitude !== undefined && { current_longitude: new Prisma.Decimal(current_longitude) })
      }
    })

    // A position report from the vehicle terminal moves the marker on every
    // console without waiting for a refresh.
    if (current_latitude !== undefined && current_longitude !== undefined) {
      eventHub.publish({
        type: "vehicle.moved",
        payload: {
          id: updated.id,
          prefix: updated.prefix,
          latitude: String(updated.current_latitude),
          longitude: String(updated.current_longitude)
        }
      })
    }

    return updated
  }
}
