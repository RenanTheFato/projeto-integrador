import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";

export class DeleteUnitService {
  async execute(id: string): Promise<void> {

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { children: true, firefighters: true, vehicles: true, crews: true, shifts: true, occurrences: true }
        }
      }
    })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    // Apagar uma unidade com historico apagaria ocorrencias e efetivo junto.
    // Nesses casos o correto e desativar (PATCH active=false), nao remover.
    const links = Object.entries(unit._count)
      .filter(([, count]) => count > 0)
      .map(([relation, count]) => `${relation}: ${count}`)

    if (links.length > 0) {
      throw new ConflictError(`Unit still has linked records (${links.join(", ")}). Deactivate it instead of deleting.`)
    }

    await prisma.unit.delete({ where: { id } })
  }
}
