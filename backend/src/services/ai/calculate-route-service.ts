import { Prisma, Route } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";
import { AiClient } from "./ai-client.js";

interface CalculateRouteRequest {
  origin_latitude?: number,
  origin_longitude?: number,
  /// Alternative to raw coordinates: depart from a unit's address.
  origin_unit_id?: string,
  destination_latitude: number,
  destination_longitude: number,
  /// When given, the result is stored and linked to the dispatch.
  dispatch_id?: string
}

export class CalculateRouteService {
  async execute(data: CalculateRouteRequest): Promise<{ routes: Route[] | null, neural: unknown, shortest: unknown }> {

    const origin = await this.resolveOrigin(data)

    const destination = {
      latitude: data.destination_latitude,
      longitude: data.destination_longitude
    }

    if (data.dispatch_id) {
      const dispatch = await prisma.dispatch.findUnique({
        where: { id: data.dispatch_id },
        select: { id: true }
      })

      if (!dispatch) {
        throw new NotFoundError("Dispatch not found")
      }
    }

    const result = await new AiClient().calculateRoute(origin, destination)

    // Without a dispatch this is an exploratory query (the "what would the
    // route be" case), so nothing is persisted.
    if (!data.dispatch_id) {
      return { routes: null, neural: result.neural, shortest: result.shortest }
    }

    const rows = (["NEURAL", "DIJKSTRA"] as const).map((algorithm) => {
      const variant = algorithm === "NEURAL" ? result.neural : result.shortest

      return {
        algorithm,
        dispatch_id: data.dispatch_id!,
        origin_latitude: new Prisma.Decimal(origin.latitude),
        origin_longitude: new Prisma.Decimal(origin.longitude),
        destination_latitude: new Prisma.Decimal(destination.latitude),
        destination_longitude: new Prisma.Decimal(destination.longitude),
        distance_meters: variant.distance_meters,
        estimated_time_seconds: variant.estimated_time_seconds,
        node_count: variant.node_count,
        geometry: variant.geometry,
        model_version: result.model_version
      }
    })

    await prisma.route.createMany({ data: rows })

    const routes = await prisma.route.findMany({
      where: { dispatch_id: data.dispatch_id },
      orderBy: { created_at: "desc" },
      take: 2
    })

    return { routes, neural: result.neural, shortest: result.shortest }
  }

  private async resolveOrigin(data: CalculateRouteRequest) {
    if (data.origin_unit_id) {
      const unit = await prisma.unit.findUnique({
        where: { id: data.origin_unit_id },
        select: { latitude: true, longitude: true }
      })

      if (!unit) {
        throw new NotFoundError("Origin unit not found")
      }

      return { latitude: Number(unit.latitude), longitude: Number(unit.longitude) }
    }

    return {
      latitude: data.origin_latitude!,
      longitude: data.origin_longitude!
    }
  }
}
