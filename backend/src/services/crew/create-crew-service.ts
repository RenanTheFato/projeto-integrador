import { Crew, CrewRole } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface CrewMemberInput {
  firefighter_id: string,
  role: CrewRole
}

interface CreateCrewRequest {
  name: string,
  vehicle_id: string,
  unit_id: string,
  commander_id?: string,
  started_at: Date,
  ended_at?: Date,
  members: CrewMemberInput[]
}

export class CreateCrewService {
  async execute({ name, vehicle_id, unit_id, commander_id, started_at, ended_at, members }: CreateCrewRequest): Promise<Crew> {

    if (ended_at && ended_at <= started_at) {
      throw new BadRequestError("The ended_at must be later than started_at")
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle_id },
      select: { id: true, crew_capacity: true, status: true }
    })

    if (!vehicle) {
      throw new NotFoundError("Vehicle not found")
    }

    if (members.length > vehicle.crew_capacity) {
      throw new BadRequestError(`This vehicle holds at most ${vehicle.crew_capacity} people, but ${members.length} were provided`)
    }

    const unit = await prisma.unit.findUnique({ where: { id: unit_id }, select: { id: true } })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    // A vehicle can only carry one crew on duty at a time.
    const activeCrew = await prisma.crew.findFirst({
      where: { vehicle_id, active: true },
      select: { id: true, name: true }
    })

    if (activeCrew) {
      throw new ConflictError(`Vehicle already has an active crew (${activeCrew.name})`)
    }

    const ids = members.map((member) => member.firefighter_id)

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestError("The same firefighter was listed more than once")
    }

    if (commander_id && !ids.includes(commander_id)) {
      throw new BadRequestError("The commander must also be listed as a crew member")
    }

    const available = await prisma.firefighter.findMany({
      where: { id: { in: ids } },
      select: { id: true, war_name: true, status: true }
    })

    if (available.length !== ids.length) {
      throw new NotFoundError("One or more firefighters were not found")
    }

    const unavailable = available.filter((firefighter) => firefighter.status !== "ATIVO")

    if (unavailable.length > 0) {
      throw new ConflictError(`Not on active duty: ${unavailable.map((f) => f.war_name).join(", ")}`)
    }

    return prisma.crew.create({
      data: {
        name,
        vehicle_id,
        unit_id,
        commander_id: commander_id ?? null,
        started_at,
        ended_at: ended_at ?? null,
        members: {
          create: members.map((member) => ({
            firefighter_id: member.firefighter_id,
            role: member.role
          }))
        }
      },
      include: {
        members: {
          include: { firefighter: { select: { id: true, war_name: true, rank: true } } }
        }
      }
    })
  }
}
