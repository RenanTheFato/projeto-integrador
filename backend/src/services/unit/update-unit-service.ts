import { Prisma, Unit } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface UpdateUnitRequest {
  id: string,
  name?: string,
  acronym?: string,
  address?: string,
  latitude?: number,
  longitude?: number,
  phone?: string,
  active?: boolean,
  parent_id?: string | null
}

export class UpdateUnitService {
  async execute({ id, acronym, latitude, longitude, parent_id, ...rest }: UpdateUnitRequest): Promise<Unit> {

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: { id: true, type: true }
    })

    if (!unit) {
      throw new NotFoundError("Unit not found")
    }

    if (acronym) {
      const acronymOwner = await prisma.unit.findUnique({
        where: { acronym },
        select: { id: true }
      })

      if (acronymOwner && acronymOwner.id !== id) {
        throw new ConflictError("Acronym already registered for another unit")
      }
    }

    if (parent_id !== undefined && parent_id !== null) {
      if (parent_id === id) {
        throw new BadRequestError("A unit cannot be its own parent")
      }

      const parent = await prisma.unit.findUnique({
        where: { id: parent_id },
        select: { id: true }
      })

      if (!parent) {
        throw new NotFoundError("Parent unit not found")
      }

      if (await this.wouldCreateCycle(id, parent_id)) {
        throw new BadRequestError("This parent would create a cycle in the unit hierarchy")
      }
    }

    return prisma.unit.update({
      where: { id },
      data: {
        ...rest,
        ...(acronym && { acronym }),
        ...(latitude !== undefined && { latitude: new Prisma.Decimal(latitude) }),
        ...(longitude !== undefined && { longitude: new Prisma.Decimal(longitude) }),
        ...(parent_id !== undefined && { parent_id })
      }
    })
  }

  /// Sobe a cadeia a partir do novo pai; se reencontrar a propria unidade,
  /// a mudanca fecharia um ciclo e deixaria a arvore invalida.
  private async wouldCreateCycle(unitId: string, newParentId: string): Promise<boolean> {
    let current: string | null = newParentId

    while (current) {
      if (current === unitId) {
        return true
      }

      const parent: { parent_id: string | null } | null = await prisma.unit.findUnique({
        where: { id: current },
        select: { parent_id: true }
      })

      current = parent?.parent_id ?? null
    }

    return false
  }
}
