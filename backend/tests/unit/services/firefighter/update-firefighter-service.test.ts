jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    firefighter: { findUnique: jest.fn(), update: jest.fn() },
    unit: { findUnique: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { UpdateFirefighterService } from "../../../../src/services/firefighter/update-firefighter-service.js"

const mockPrisma = prisma as unknown as {
  firefighter: { findUnique: jest.Mock, update: jest.Mock },
  unit: { findUnique: jest.Mock }
}

describe("UpdateFirefighterService", () => {
  const service = new UpdateFirefighterService()

  it("throws NotFoundError when the firefighter does not exist", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ id: "missing", name: "x" })).rejects.toThrow(NotFoundError)
  })

  it("throws NotFoundError when the target unit does not exist", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ id: "ff1", unit_id: "missing-unit" })).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when transferring to an inactive unit", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit2", active: false })

    await expect(service.execute({ id: "ff1", unit_id: "unit2" }))
      .rejects.toThrow("Cannot transfer a firefighter to an inactive unit")
  })

  it("throws ConflictError when the e-mail belongs to another firefighter", async () => {
    mockPrisma.firefighter.findUnique
      .mockResolvedValueOnce({ id: "ff1" }) // firefighter itself
      .mockResolvedValueOnce({ id: "ff2" }) // e-mail owner, different id

    await expect(service.execute({ id: "ff1", email: "taken@bombeiros.local" }))
      .rejects.toThrow(ConflictError)
  })

  it("allows keeping the firefighter's own e-mail", async () => {
    mockPrisma.firefighter.findUnique
      .mockResolvedValueOnce({ id: "ff1" })
      .mockResolvedValueOnce({ id: "ff1" }) // owned by itself
    mockPrisma.firefighter.update.mockResolvedValueOnce({ id: "ff1", email: "same@bombeiros.local" })

    await expect(service.execute({ id: "ff1", email: "same@bombeiros.local" })).resolves.toBeDefined()
  })

  it("does not immutably reject a plain field update like name or phone", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1" })
    mockPrisma.firefighter.update.mockResolvedValueOnce({ id: "ff1", name: "Novo Nome" })

    const result = await service.execute({ id: "ff1", name: "Novo Nome" })

    expect(mockPrisma.firefighter.update).toHaveBeenCalledWith({
      where: { id: "ff1" },
      data: { name: "Novo Nome" }
    })
    expect(result).toHaveProperty("name", "Novo Nome")
  })
})
