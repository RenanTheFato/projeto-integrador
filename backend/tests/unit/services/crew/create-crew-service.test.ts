jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    vehicle: { findUnique: jest.fn() },
    unit: { findUnique: jest.fn() },
    crew: { findFirst: jest.fn(), create: jest.fn() },
    firefighter: { findMany: jest.fn() }
  }
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { CreateCrewService } from "../../../../src/services/crew/create-crew-service.js"

const mockPrisma = prisma as unknown as {
  vehicle: { findUnique: jest.Mock },
  unit: { findUnique: jest.Mock },
  crew: { findFirst: jest.Mock, create: jest.Mock },
  firefighter: { findMany: jest.Mock }
}

const baseRequest = {
  name: "Guarnição Alfa",
  vehicle_id: "v1",
  unit_id: "unit1",
  started_at: new Date("2026-01-01T08:00:00Z"),
  members: [
    { firefighter_id: "ff1", role: "COMANDANTE" as const },
    { firefighter_id: "ff2", role: "MOTORISTA" as const }
  ]
}

describe("CreateCrewService", () => {
  const service = new CreateCrewService()

  it("throws BadRequestError when ended_at is not later than started_at", async () => {
    await expect(service.execute({ ...baseRequest, ended_at: baseRequest.started_at }))
      .rejects.toThrow("The ended_at must be later than started_at")
  })

  it("throws NotFoundError when the vehicle does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute(baseRequest)).rejects.toThrow(NotFoundError)
  })

  it("throws BadRequestError when there are more members than the vehicle's crew capacity", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 1, status: "DISPONIVEL" })

    await expect(service.execute(baseRequest))
      .rejects.toThrow("This vehicle holds at most 1 people, but 2 were provided")
  })

  it("throws NotFoundError when the unit does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute(baseRequest)).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the vehicle already has an active crew", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.crew.findFirst.mockResolvedValueOnce({ id: "active-crew", name: "Guarnição Bravo" })

    await expect(service.execute(baseRequest))
      .rejects.toThrow("Vehicle already has an active crew (Guarnição Bravo)")
  })

  it("throws BadRequestError when the same firefighter is listed twice", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.crew.findFirst.mockResolvedValueOnce(null)

    const duplicateMembers = [
      { firefighter_id: "ff1", role: "COMANDANTE" as const },
      { firefighter_id: "ff1", role: "MOTORISTA" as const }
    ]

    await expect(service.execute({ ...baseRequest, members: duplicateMembers }))
      .rejects.toThrow("The same firefighter was listed more than once")
  })

  it("throws BadRequestError when the commander is not among the members", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.crew.findFirst.mockResolvedValueOnce(null)

    await expect(service.execute({ ...baseRequest, commander_id: "outsider" }))
      .rejects.toThrow("The commander must also be listed as a crew member")
  })

  it("throws NotFoundError when a listed firefighter does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.crew.findFirst.mockResolvedValueOnce(null)
    mockPrisma.firefighter.findMany.mockResolvedValueOnce([
      { id: "ff1", war_name: "Silva", status: "ATIVO" }
    ])

    await expect(service.execute(baseRequest)).rejects.toThrow("One or more firefighters were not found")
  })

  it("throws ConflictError listing firefighters not on active duty", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.crew.findFirst.mockResolvedValueOnce(null)
    mockPrisma.firefighter.findMany.mockResolvedValueOnce([
      { id: "ff1", war_name: "Silva", status: "ATIVO" },
      { id: "ff2", war_name: "Souza", status: "FERIAS" }
    ])

    await expect(service.execute(baseRequest)).rejects.toThrow("Not on active duty: Souza")
  })

  it("creates the crew when every check passes", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", crew_capacity: 4, status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.crew.findFirst.mockResolvedValueOnce(null)
    mockPrisma.firefighter.findMany.mockResolvedValueOnce([
      { id: "ff1", war_name: "Silva", status: "ATIVO" },
      { id: "ff2", war_name: "Souza", status: "ATIVO" }
    ])
    mockPrisma.crew.create.mockResolvedValueOnce({ id: "crew1", ...baseRequest })

    const result = await service.execute({ ...baseRequest, commander_id: "ff1" })

    expect(result).toHaveProperty("id", "crew1")
  })
})
