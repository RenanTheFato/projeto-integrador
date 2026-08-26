jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    unit: { findUnique: jest.fn() },
    firefighter: { findFirst: jest.fn(), create: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { CreateFirefighterService } from "../../../../src/services/firefighter/create-firefighter-service.js"

const mockPrisma = prisma as unknown as {
  unit: { findUnique: jest.Mock },
  firefighter: { findFirst: jest.Mock, create: jest.Mock }
}

const baseRequest = {
  name: "João da Silva",
  war_name: "Silva",
  military_id: "12345",
  cpf: "52998224725",
  rank: "SOLDADO_SEGUNDA_CLASSE" as const,
  phone: "1234567890",
  admission_date: new Date("2020-01-01"),
  unit_id: "unit1"
}

describe("CreateFirefighterService", () => {
  const service = new CreateFirefighterService()

  it("throws NotFoundError when the unit does not exist", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute(baseRequest)).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the unit is inactive", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: false })

    await expect(service.execute(baseRequest)).rejects.toThrow("Cannot assign a firefighter to an inactive unit")
  })

  it("throws ConflictError naming military_id when that is the duplicate field", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.firefighter.findFirst.mockResolvedValueOnce({
      military_id: baseRequest.military_id, cpf: "other", email: null
    })

    await expect(service.execute(baseRequest)).rejects.toThrow("military_id is already registered")
  })

  it("throws ConflictError naming cpf when that is the duplicate field", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.firefighter.findFirst.mockResolvedValueOnce({
      military_id: "other", cpf: baseRequest.cpf, email: null
    })

    await expect(service.execute(baseRequest)).rejects.toThrow("cpf is already registered")
  })

  it("throws ConflictError naming e-mail when that is the duplicate field", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.firefighter.findFirst.mockResolvedValueOnce({
      military_id: "other", cpf: "other-cpf", email: "taken@bombeiros.local"
    })

    await expect(service.execute({ ...baseRequest, email: "taken@bombeiros.local" }))
      .rejects.toThrow("e-mail is already registered")
  })

  it("creates the firefighter when there is no duplicate", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.firefighter.findFirst.mockResolvedValueOnce(null)
    mockPrisma.firefighter.create.mockResolvedValueOnce({ id: "ff1", ...baseRequest })

    const result = await service.execute(baseRequest)

    expect(result).toHaveProperty("id", "ff1")
    expect(mockPrisma.firefighter.create).toHaveBeenCalledWith({
      data: { ...baseRequest, email: null }
    })
  })
})
