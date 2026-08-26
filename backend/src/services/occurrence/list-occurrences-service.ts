import { OccurrenceNature, OccurrencePriority, OccurrenceStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

interface ListOccurrencesRequest {
  unit_id?: string,
  status?: OccurrenceStatus,
  nature?: OccurrenceNature,
  priority?: OccurrencePriority,
  from?: Date,
  to?: Date,
  search?: string,
  page: number,
  per_page: number
}

export class ListOccurrencesService {
  async execute({ unit_id, status, nature, priority, from, to, search, page, per_page }: ListOccurrencesRequest) {

    const where = {
      ...(unit_id && { unit_id }),
      ...(status && { status }),
      ...(nature && { nature }),
      ...(priority && { priority }),
      ...((from || to) && {
        opened_at: {
          ...(from && { gte: from }),
          ...(to && { lte: to })
        }
      }),
      ...(search && {
        OR: [
          { protocol: { contains: search, mode: "insensitive" as const } },
          { address: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } }
        ]
      })
    }

    const [occurrences, total] = await Promise.all([
      prisma.occurrence.findMany({
        where,
        include: {
          unit: { select: { id: true, acronym: true } },
          _count: { select: { dispatches: true } }
        },
        // Critical incidents first, then the oldest still waiting.
        orderBy: [{ priority: "desc" }, { opened_at: "asc" }],
        skip: (page - 1) * per_page,
        take: per_page
      }),
      prisma.occurrence.count({ where })
    ])

    return { occurrences, total, page, per_page }
  }
}
