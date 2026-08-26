jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    unit: { findUnique: jest.fn(), update: jest.fn() }
  }
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { UpdateUnitService } from "../../../../src/services/unit/update-unit-service.js"

const mockPrisma = prisma as unknown as {
  unit: { findUnique: jest.Mock, update: jest.Mock }
}

describe("UpdateUnitService", () => {
  const service = new UpdateUnitService()

  it("throws NotFoundError when the unit does not exist", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ id: "missing", name: "x" })).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the new acronym belongs to another unit", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce({ id: "u1", type: "POSTO" }) // the unit itself
      .mockResolvedValueOnce({ id: "u2" }) // acronym owner, different id

    await expect(service.execute({ id: "u1", acronym: "TAKEN" })).rejects.toThrow(ConflictError)
  })

  it("allows keeping the same acronym on the same unit", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce({ id: "u1", type: "POSTO" })
      .mockResolvedValueOnce({ id: "u1" }) // acronym already owned by itself
    mockPrisma.unit.update.mockResolvedValueOnce({ id: "u1", acronym: "SAME" })

    await expect(service.execute({ id: "u1", acronym: "SAME" })).resolves.toBeDefined()
  })

  it("throws BadRequestError when a unit is set as its own parent", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "u1", type: "POSTO" })

    await expect(service.execute({ id: "u1", parent_id: "u1" }))
      .rejects.toThrow("A unit cannot be its own parent")
  })

  it("throws NotFoundError when the new parent does not exist", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce({ id: "u1", type: "POSTO" })
      .mockResolvedValueOnce(null) // parent lookup

    await expect(service.execute({ id: "u1", parent_id: "missing" })).rejects.toThrow(NotFoundError)
  })

  it("throws BadRequestError when the new parent would create a cycle", async () => {
    // u1 -> currently has descendant u2, which has descendant u3.
    // Reparenting u1 under u3 (its own grandchild) must be rejected.
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce({ id: "u1", type: "POSTO" }) // unit itself
      .mockResolvedValueOnce({ id: "u3" }) // parent exists
      .mockResolvedValueOnce({ parent_id: "u2" }) // walk: u3's parent is u2
      .mockResolvedValueOnce({ parent_id: "u1" }) // walk: u2's parent is u1 -> cycle found

    await expect(service.execute({ id: "u1", parent_id: "u3" }))
      .rejects.toThrow("This parent would create a cycle in the unit hierarchy")
  })

  it("updates the unit when the new parent does not create a cycle", async () => {
    mockPrisma.unit.findUnique
      .mockResolvedValueOnce({ id: "u1", type: "POSTO" })
      .mockResolvedValueOnce({ id: "u9" })
      .mockResolvedValueOnce({ parent_id: null }) // u9 has no parent -> chain ends, no cycle
    mockPrisma.unit.update.mockResolvedValueOnce({ id: "u1", parent_id: "u9" })

    const result = await service.execute({ id: "u1", parent_id: "u9" })

    expect(result).toHaveProperty("parent_id", "u9")
  })

  it("allows clearing the parent by passing null", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "u1", type: "COMANDO_GERAL" })
    mockPrisma.unit.update.mockResolvedValueOnce({ id: "u1", parent_id: null })

    await service.execute({ id: "u1", parent_id: null })

    expect(mockPrisma.unit.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ parent_id: null })
    })
  })
})
