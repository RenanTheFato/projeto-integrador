import { env } from "../../config/env.js";
import { BadRequestError, ServiceUnavailableError } from "../../errors/index.js";

export interface RouteVariant {
  distance_meters: number,
  estimated_time_seconds: number,
  node_count: number,
  geometry: [number, number][]
}

export interface RouteResponse {
  neural: RouteVariant,
  shortest: RouteVariant,
  model_version: string | null
}

export interface TrainingJob {
  job_id: string,
  status: "PENDENTE" | "EXECUTANDO" | "CONCLUIDO" | "FALHOU",
  epochs: number,
  train_loss: number | null,
  validation_loss: number | null,
  best_validation_loss: number | null,
  started_at: string | null,
  finished_at: string | null,
  error_message: string | null,
  model_path: string | null
}

export interface ModelInfo {
  loaded: boolean,
  model_version: string | null,
  city: string,
  graph_nodes: number,
  graph_edges: number
}

/// Thin HTTP client for the Python (FastAPI) side. Every network failure is
/// translated to ServiceUnavailableError so callers never leak fetch details,
/// and a 4xx from the AI service becomes a BadRequestError because it means
/// the coordinates we sent were rejected, not that the service is down.
export class AiClient {

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS)

    let response: Response

    try {
      response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError"
        ? `did not answer within ${env.AI_SERVICE_TIMEOUT_MS}ms`
        : "is unreachable"
      throw new ServiceUnavailableError(`The AI service ${reason} (${env.AI_SERVICE_URL})`)
    } finally {
      clearTimeout(timeout)
    }

    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (response.status >= 400 && response.status < 500) {
      throw new BadRequestError(payload?.detail ?? "The AI service rejected the request")
    }

    if (!response.ok) {
      throw new ServiceUnavailableError(payload?.detail ?? `The AI service failed with status ${response.status}`)
    }

    return payload as T
  }

  async calculateRoute(origin: { latitude: number, longitude: number }, destination: { latitude: number, longitude: number }): Promise<RouteResponse> {
    return this.request<RouteResponse>("POST", "/routes", {
      origin_latitude: origin.latitude,
      origin_longitude: origin.longitude,
      destination_latitude: destination.latitude,
      destination_longitude: destination.longitude
    })
  }

  async startTraining(epochs: number): Promise<TrainingJob> {
    return this.request<TrainingJob>("POST", "/training", { epochs })
  }

  async getTraining(jobId: string): Promise<TrainingJob> {
    return this.request<TrainingJob>("GET", `/training/${jobId}`)
  }

  async getModelInfo(): Promise<ModelInfo> {
    return this.request<ModelInfo>("GET", "/model")
  }
}
