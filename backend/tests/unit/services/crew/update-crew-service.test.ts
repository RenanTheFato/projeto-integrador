jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    crew: { findUnique: jest.fn(), update: jest.fn() },
    firefighter: { count: jest.fn() },
    dispatch: { findFirst: jest.fn() }
  }
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { UpdateCrewService } from "../../../../src/services/crew/update-crew-service.js"

const mockPrisma = prisma as unknown as {
  crew: { findUnique: jest.Mock, update: jest.Mock },
  firefighter: { count: jest.Mock },
  dispatch: { findFirst: jest.Mock }
}

const existingCrew = {
  id: "crew1",
  started_at: new Date("2026-01-01T08:00:00Z"),
  vehicle: { crew_capacity: 2 },
  members: [{ firefighter_id: "ff1" }]
}

describe("UpdateCrewService", () => {
  const service = new UpdateCrewService()

  it("throws NotFoundError when the crew does not exist", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ id: "missing" })).rejects.toThrow(NotFoundError)
  })

  it("throws BadRequestError when ended_at is not later than started_at", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)

    await expect(service.execute({ id: "crew1", ended_at: existingCrew.started_at }))
      .rejects.toThrow("The ended_at must be later than started_at")
  })

  it("throws BadRequestError when the new roster exceeds the vehicle's crew capacity", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)

    const tooMany = [
      { firefighter_id: "ff1", role: "COMANDANTE" as const },
      { firefighter_id: "ff2", role: "MOTORISTA" as const },
      { firefighter_id: "ff3", role: "COMBATENTE" as const }
    ]

    await expect(service.execute({ id: "crew1", members: tooMany }))
      .rejects.toThrow("This vehicle holds at most 2 people, but 3 were provided")
  })

  it("throws BadRequestError when the new roster repeats a firefighter", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)

    const repeated = [
      { firefighter_id: "ff1", role: "COMANDANTE" as const },
      { firefighter_id: "ff1", role: "MOTORISTA" as const }
    ]

    await expect(service.execute({ id: "crew1", members: repeated }))
      .rejects.toThrow("The same firefighter was listed more than once")
  })

  it("throws NotFoundError when a new roster member does not exist", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)
    mockPrisma.firefighter.count.mockResolvedValueOnce(1)

    const members = [
      { firefighter_id: "ff1", role: "COMANDANTE" as const },
      { firefighter_id: "ghost", role: "MOTORISTA" as const }
    ]

    await expect(service.execute({ id: "crew1", members })).rejects.toThrow("One or more firefighters were not found")
  })

  it("throws BadRequestError when the commander is not in the resulting roster", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)

    await expect(service.execute({ id: "crew1", commander_id: "outsider" }))
      .rejects.toThrow("The commander must also be listed as a crew member")
  })

  it("throws ConflictError when deactivating a crew still tied to an open dispatch", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)
    mockPrisma.dispatch.findFirst.mockResolvedValueOnce({ id: "d1" })

    await expect(service.execute({ id: "crew1", active: false }))
      .rejects.toThrow("This crew is assigned to an open dispatch. Finish or cancel it first.")
  })

  it("allows deactivating a crew once no dispatch is open", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)
    mockPrisma.dispatch.findFirst.mockResolvedValueOnce(null)
    mockPrisma.crew.update.mockResolvedValueOnce({ id: "crew1", active: false })

    await expect(service.execute({ id: "crew1", active: false })).resolves.toBeDefined()
  })

  it("updates a plain field without touching the roster or the open-dispatch check", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(existingCrew)
    mockPrisma.crew.update.mockResolvedValueOnce({ id: "crew1", name: "Novo Nome" })

    await service.execute({ id: "crew1", name: "Novo Nome" })

    expect(mockPrisma.dispatch.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.crew.update).toHaveBeenCalledWith({
      where: { id: "crew1" },
      data: { name: "Novo Nome" },
      include: expect.any(Object)
    })
  })
})
