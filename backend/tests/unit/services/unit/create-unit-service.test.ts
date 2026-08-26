jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    unit: { findUnique: jest.fn(), create: jest.fn() }
  }
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { CreateUnitService } from "../../../../src/services/unit/create-unit-service.js"

const mockPrisma = prisma as unknown as {
  unit: { findUnique: jest.Mock, create: jest.Mock }
}

const baseRequest = {
  name: "Posto Central",
  acronym: "PB-CENTRAL",
  type: "POSTO" as const,
  address: "Rua Principal, 100",
  latitude: -23.0264,
  longitude: -45.5553,
  phone: "1234567890"
}

describe("CreateUnitService", () => {
  const service = new CreateUnitService()

  it("throws ConflictError when the acronym is already registered", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "existing" })

    await expect(service.execute(baseRequest)).rejects.toThrow(ConflictError)
  })

  it("throws BadRequestError when a non COMANDO_GERAL unit has no parent", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null) // acronym check

    await expect(service.execute(baseRequest))
      .rejects.toThrow("Only a COMANDO_GERAL unit can exist without a parent")
  })

  it("allows a COMANDO_GERAL unit without a parent", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)
    mockPrisma.unit.create.mockResolvedValueOnce({ id: "u1" })

    await expect(service.execute({ ...baseRequest, type: "COMANDO_GERAL" })).resolves.toBeDefined()
  })

  it("throws NotFoundError when parent_id does not exist", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce(null) // acronym check
      .mockResolvedValueOnce(null) // parent lookup

    await expect(service.execute({ ...baseRequest, parent_id: "missing" }))
      .rejects.toThrow(NotFoundError)
  })

  it("throws BadRequestError when the parent is not strictly above the new unit's level", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce(null) // acronym check
      .mockResolvedValueOnce({ id: "parent", type: "POSTO" }) // parent, same level as POSTO

    await expect(service.execute({ ...baseRequest, type: "POSTO", parent_id: "parent" }))
      .rejects.toThrow("A POSTO cannot be subordinated to a POSTO")
  })

  it("creates the unit when the parent is a strictly higher level", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce(null) // acronym check
      .mockResolvedValueOnce({ id: "parent", type: "SUBGRUPAMENTO" })
    mockPrisma.unit.create.mockResolvedValueOnce({ id: "u1", ...baseRequest, parent_id: "parent" })

    const result = await service.execute({ ...baseRequest, parent_id: "parent" })

    expect(result).toHaveProperty("id", "u1")
    expect(mockPrisma.unit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parent_id: "parent" })
    })
  })
})
