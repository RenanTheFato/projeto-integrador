jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    trainingRun: {
      findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(),
      findMany: jest.fn(), count: jest.fn()
    }
  }
}))

jest.mock("../../../../src/services/ai/ai-client.js", () => {
  const startTraining = jest.fn()
  const getTraining = jest.fn()
  return {
    AiClient: jest.fn().mockImplementation(() => ({ startTraining, getTraining })),
    __mock: { startTraining, getTraining }
  }
})

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { AiClient } from "../../../../src/services/ai/ai-client.js"
import { GetTrainingService, ListTrainingsService, StartTrainingService } from "../../../../src/services/ai/training-service.js"

const mockPrisma = prisma as unknown as {
  trainingRun: {
    findFirst: jest.Mock, create: jest.Mock, findUnique: jest.Mock, update: jest.Mock,
    findMany: jest.Mock, count: jest.Mock
  }
}

const AiClientMock = AiClient as unknown as jest.Mock
const aiClientMock = jest.requireMock("../../../../src/services/ai/ai-client.js") as {
  __mock: { startTraining: jest.Mock, getTraining: jest.Mock }
}

beforeEach(() => {
  AiClientMock.mockImplementation(() => ({
    startTraining: aiClientMock.__mock.startTraining,
    getTraining: aiClientMock.__mock.getTraining
  }))
})

describe("StartTrainingService", () => {
  const service = new StartTrainingService()

  it("throws ConflictError when a run is already PENDENTE or EXECUTANDO", async () => {
    mockPrisma.trainingRun.findFirst.mockResolvedValueOnce({ id: "running" })

    await expect(service.execute(500)).rejects.toThrow(ConflictError)
    expect(aiClientMock.__mock.startTraining).not.toHaveBeenCalled()
  })

  it("starts a job through the AI service and mirrors it into the database", async () => {
    mockPrisma.trainingRun.findFirst.mockResolvedValueOnce(null)
    aiClientMock.__mock.startTraining.mockResolvedValueOnce({
      job_id: "job1", status: "PENDENTE", started_at: null
    })
    mockPrisma.trainingRun.create.mockResolvedValueOnce({ id: "run1", epochs: 500, status: "PENDENTE" })

    const result = await service.execute(500)

    expect(aiClientMock.__mock.startTraining).toHaveBeenCalledWith(500)
    expect(mockPrisma.trainingRun.create).toHaveBeenCalledWith({
      data: { epochs: 500, status: "PENDENTE", external_job_id: "job1", started_at: null }
    })
    expect(result).toHaveProperty("id", "run1")
  })
})

describe("GetTrainingService", () => {
  const service = new GetTrainingService()

  it("throws NotFoundError when the run does not exist", async () => {
    mockPrisma.trainingRun.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute("missing")).rejects.toThrow(NotFoundError)
  })

  it("returns the stored run without contacting the AI service once it is CONCLUIDO", async () => {
    mockPrisma.trainingRun.findUnique.mockResolvedValueOnce({
      id: "run1", status: "CONCLUIDO", external_job_id: "job1"
    })

    const result = await service.execute("run1")

    expect(aiClientMock.__mock.getTraining).not.toHaveBeenCalled()
    expect(result).toHaveProperty("status", "CONCLUIDO")
  })

  it("refreshes an in-flight run from the AI service and persists the progress", async () => {
    mockPrisma.trainingRun.findUnique.mockResolvedValueOnce({
      id: "run1", status: "EXECUTANDO", external_job_id: "job1", started_at: new Date("2026-01-01")
    })
    aiClientMock.__mock.getTraining.mockResolvedValueOnce({
      status: "EXECUTANDO", train_loss: 0.1, validation_loss: 0.12, best_validation_loss: 0.12,
      started_at: "2026-01-01T00:00:00.000Z", finished_at: null, error_message: null, model_path: null
    })
    mockPrisma.trainingRun.update.mockResolvedValueOnce({ id: "run1", status: "EXECUTANDO", train_loss: 0.1 })

    const result = await service.execute("run1")

    expect(mockPrisma.trainingRun.update).toHaveBeenCalledWith({
      where: { id: "run1" },
      data: expect.objectContaining({ status: "EXECUTANDO", train_loss: 0.1 })
    })
    expect(result).toHaveProperty("train_loss", 0.1)
  })

  it("falls back to the last known run when the AI service is unreachable", async () => {
    const staleRun = { id: "run1", status: "EXECUTANDO", external_job_id: "job1", started_at: new Date("2026-01-01") }
    mockPrisma.trainingRun.findUnique.mockResolvedValueOnce(staleRun)
    aiClientMock.__mock.getTraining.mockRejectedValueOnce(new Error("AI service is unreachable"))
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    const result = await service.execute("run1")

    expect(result).toBe(staleRun)
    expect(mockPrisma.trainingRun.update).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})

describe("ListTrainingsService", () => {
  const service = new ListTrainingsService()

  it("paginates using skip/take derived from page and per_page", async () => {
    mockPrisma.trainingRun.findMany.mockResolvedValueOnce([{ id: "run1" }])
    mockPrisma.trainingRun.count.mockResolvedValueOnce(21)

    const result = await service.execute({ page: 3, per_page: 10 })

    expect(mockPrisma.trainingRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
    expect(result).toEqual({ runs: [{ id: "run1" }], total: 21, page: 3, per_page: 10 })
  })
})
