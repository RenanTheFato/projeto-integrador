import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";

export class DeleteCrewService {
  async execute(id: string): Promise<void> {

    const crew = await prisma.crew.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { dispatches: true } }
      }
    })

    if (!crew) {
      throw new NotFoundError("Crew not found")
    }

    if (crew._count.dispatches > 0) {
      throw new ConflictError(`Crew is referenced by ${crew._count.dispatches} dispatch(es). Deactivate it instead of deleting.`)
    }

    // Members go with the crew: CrewMember cascades on delete.
    await prisma.crew.delete({ where: { id } })
  }
}
