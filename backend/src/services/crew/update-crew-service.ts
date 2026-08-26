import { Crew, CrewRole } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface CrewMemberInput {
  firefighter_id: string,
  role: CrewRole
}

interface UpdateCrewRequest {
  id: string,
  name?: string,
  commander_id?: string | null,
  ended_at?: Date | null,
  active?: boolean,
  /// When provided, replaces the whole roster. Partial edits are not supported
  /// on purpose: a crew is a snapshot of who boarded, not an evolving list.
  members?: CrewMemberInput[]
}

export class UpdateCrewService {
  async execute({ id, members, commander_id, ...rest }: UpdateCrewRequest): Promise<Crew> {

    const crew = await prisma.crew.findUnique({
      where: { id },
      select: {
        id: true,
        started_at: true,
        vehicle: { select: { crew_capacity: true } },
        members: { select: { firefighter_id: true } }
      }
    })

    if (!crew) {
      throw new NotFoundError("Crew not found")
    }

    if (rest.ended_at && rest.ended_at <= crew.started_at) {
      throw new BadRequestError("The ended_at must be later than started_at")
    }

    if (members) {
      if (members.length > crew.vehicle.crew_capacity) {
        throw new BadRequestError(`This vehicle holds at most ${crew.vehicle.crew_capacity} people, but ${members.length} were provided`)
      }

      const ids = members.map((member) => member.firefighter_id)

      if (new Set(ids).size !== ids.length) {
        throw new BadRequestError("The same firefighter was listed more than once")
      }

      const found = await prisma.firefighter.count({ where: { id: { in: ids } } })

      if (found !== ids.length) {
        throw new NotFoundError("One or more firefighters were not found")
      }
    }

    const roster = members ? members.map((member) => member.firefighter_id) : crew.members.map((member) => member.firefighter_id)

    if (commander_id && !roster.includes(commander_id)) {
      throw new BadRequestError("The commander must also be listed as a crew member")
    }

    // Releasing the crew is only valid once no dispatch still depends on it.
    if (rest.active === false) {
      const openDispatch = await prisma.dispatch.findFirst({
        where: { crew_id: id, status: { notIn: ["FINALIZADO", "CANCELADO"] } },
        select: { id: true }
      })

      if (openDispatch) {
        throw new ConflictError("This crew is assigned to an open dispatch. Finish or cancel it first.")
      }
    }

    return prisma.crew.update({
      where: { id },
      data: {
        ...rest,
        ...(commander_id !== undefined && { commander_id }),
        ...(members && {
          members: {
            deleteMany: {},
            create: members.map((member) => ({
              firefighter_id: member.firefighter_id,
              role: member.role
            }))
          }
        })
      },
      include: {
        members: {
          include: { firefighter: { select: { id: true, war_name: true, rank: true } } }
        }
      }
    })
  }
}
