import { Prisma, Unit, UnitType } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";

interface CreateUnitRequest {
  name: string,
  acronym: string,
  type: UnitType,
  address: string,
  latitude: number,
  longitude: number,
  phone: string,
  parent_id?: string
}

/// Ordem hierarquica da corporacao. Uma unidade so pode ser subordinada a outra
/// de nivel estritamente superior, o que impede montar um Grupamento abaixo de
/// um Posto, por exemplo.
const HIERARCHY_LEVEL: Record<UnitType, number> = {
  COMANDO_GERAL: 0,
  COMANDO_REGIONAL: 1,
  GRUPAMENTO: 2,
  SUBGRUPAMENTO: 3,
  POSTO: 4
}

export class CreateUnitService {
  async execute({ name, acronym, type, address, latitude, longitude, phone, parent_id }: CreateUnitRequest): Promise<Unit> {

    const unitAlreadyExists = await prisma.unit.findUnique({
      where: { acronym },
      select: { id: true }
    })

    if (unitAlreadyExists) {
      throw new ConflictError("Acronym already registered for another unit")
    }

    if (parent_id) {
      const parent = await prisma.unit.findUnique({
        where: { id: parent_id },
        select: { id: true, type: true }
      })

      if (!parent) {
        throw new NotFoundError("Parent unit not found")
      }

      if (HIERARCHY_LEVEL[parent.type] >= HIERARCHY_LEVEL[type]) {
        throw new BadRequestError(`A ${type} cannot be subordinated to a ${parent.type}`)
      }
    } else if (type !== "COMANDO_GERAL") {
      throw new BadRequestError("Only a COMANDO_GERAL unit can exist without a parent")
    }

    return prisma.unit.create({
      data: {
        name,
        acronym,
        type,
        address,
        latitude: new Prisma.Decimal(latitude),
        longitude: new Prisma.Decimal(longitude),
        phone,
        parent_id: parent_id ?? null
      }
    })
  }
}
