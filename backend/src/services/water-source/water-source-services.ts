import { Prisma, WaterSourceStatus, WaterSourceType } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";
import { haversineMeters } from "../../utils/geo.js";

const CODE_PREFIX: Record<WaterSourceType, string> = {
  HIDRANTE_COLUNA: "HID",
  HIDRANTE_SUBTERRANEO: "HID",
  CISTERNA: "CIS",
  RESERVATORIO: "RES",
  PONTO_CAPTACAO: "CAP"
}

const UNIT_SELECT = { select: { id: true, acronym: true, name: true } }

interface WaterSourceFields {
  type: WaterSourceType,
  status?: WaterSourceStatus,
  address: string,
  latitude: number,
  longitude: number,
  flow_lpm?: number | null,
  notes?: string | null,
  last_inspection_at?: Date | null,
  unit_id: string
}

async function ensureUnit(unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } })
  if (!unit) {
    throw new NotFoundError("Unit not found")
  }
}

export class CreateWaterSourceService {
  async execute({ latitude, longitude, ...data }: WaterSourceFields & { code?: string }) {
    await ensureUnit(data.unit_id)

    const code = data.code ?? await this.nextCode(data.type)

    const duplicate = await prisma.waterSource.findUnique({ where: { code }, select: { id: true } })
    if (duplicate) {
      throw new ConflictError(`A water source with code ${code} is already registered`)
    }

    return prisma.waterSource.create({
      data: {
        ...data,
        code,
        latitude: new Prisma.Decimal(latitude),
        longitude: new Prisma.Decimal(longitude)
      },
      include: { unit: UNIT_SELECT }
    })
  }

  /// `HID-0007`: the type's prefix and the next number in that series.
  private async nextCode(type: WaterSourceType): Promise<string> {
    const prefix = CODE_PREFIX[type]
    const last = await prisma.waterSource.findFirst({
      where: { code: { startsWith: `${prefix}-` } },
      orderBy: { code: "desc" },
      select: { code: true }
    })
    const next = last ? Number(last.code.split("-")[1] ?? 0) + 1 : 1
    return `${prefix}-${String(next).padStart(4, "0")}`
  }
}

export class ListWaterSourcesService {
  async execute({ unit_id, status, type }: { unit_id?: string, status?: WaterSourceStatus, type?: WaterSourceType }) {
    // The whole registry is a few hundred points at most and the map draws all
    // of them, so it is returned unpaginated.
    const water_sources = await prisma.waterSource.findMany({
      where: {
        ...(unit_id && { unit_id }),
        ...(status && { status }),
        ...(type && { type })
      },
      include: { unit: UNIT_SELECT },
      orderBy: { code: "asc" }
    })

    return { water_sources, total: water_sources.length }
  }
}

export class UpdateWaterSourceService {
  async execute({ id, latitude, longitude, ...data }: Partial<WaterSourceFields> & { id: string }) {
    const current = await prisma.waterSource.findUnique({ where: { id }, select: { id: true } })
    if (!current) {
      throw new NotFoundError("Water source not found")
    }

    if (data.unit_id) {
      await ensureUnit(data.unit_id)
    }

    return prisma.waterSource.update({
      where: { id },
      data: {
        ...data,
        ...(latitude !== undefined && { latitude: new Prisma.Decimal(latitude) }),
        ...(longitude !== undefined && { longitude: new Prisma.Decimal(longitude) })
      },
      include: { unit: UNIT_SELECT }
    })
  }
}

export class DeleteWaterSourceService {
  async execute(id: string) {
    const current = await prisma.waterSource.findUnique({ where: { id }, select: { id: true } })
    if (!current) {
      throw new NotFoundError("Water source not found")
    }
    await prisma.waterSource.delete({ where: { id } })
  }
}

/// The water points closest to an occurrence, by straight-line distance.
/// A point marked out of service is still listed (the crew may know better)
/// but never ahead of one that may work.
export class NearestWaterSourcesService {
  async execute({ occurrence_id, limit }: { occurrence_id: string, limit: number }) {
    const occurrence = await prisma.occurrence.findUnique({
      where: { id: occurrence_id },
      select: { latitude: true, longitude: true }
    })

    if (!occurrence) {
      throw new NotFoundError("Occurrence not found")
    }

    const origin = { latitude: Number(occurrence.latitude), longitude: Number(occurrence.longitude) }
    const sources = await prisma.waterSource.findMany({ include: { unit: UNIT_SELECT } })

    const rank = (status: WaterSourceStatus) => status === "INOPERANTE" ? 1 : 0

    const water_sources = sources
      .map((source) => ({
        ...source,
        distance_meters: Math.round(haversineMeters(origin, {
          latitude: Number(source.latitude),
          longitude: Number(source.longitude)
        }))
      }))
      .sort((a, b) => rank(a.status) - rank(b.status) || a.distance_meters - b.distance_meters)
      .slice(0, limit)

    return { water_sources }
  }
}
