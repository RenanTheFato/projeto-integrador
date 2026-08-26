import { Unit, UnitType } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

interface ListUnitsRequest {
  type?: UnitType,
  parent_id?: string,
  active?: boolean,
  search?: string,
  page: number,
  per_page: number
}

interface ListUnitsResponse {
  units: Unit[],
  total: number,
  page: number,
  per_page: number
}

export class ListUnitsService {
  async execute({ type, parent_id, active, search, page, per_page }: ListUnitsRequest): Promise<ListUnitsResponse> {

    const where = {
      ...(type && { type }),
      ...(parent_id && { parent_id }),
      ...(active !== undefined && { active }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { acronym: { contains: search, mode: "insensitive" as const } }
        ]
      })
    }

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: [{ type: "asc" }, { name: "asc" }],
        skip: (page - 1) * per_page,
        take: per_page
      }),
      prisma.unit.count({ where })
    ])

    return { units, total, page, per_page }
  }
}
