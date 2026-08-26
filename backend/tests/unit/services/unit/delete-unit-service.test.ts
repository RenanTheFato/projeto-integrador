jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    unit: { findUnique: jest.fn(), delete: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { DeleteUnitService } from "../../../../src/services/unit/delete-unit-service.js"

const mockPrisma = prisma as unknown as {
  unit: { findUnique: jest.Mock, delete: jest.Mock }
}

describe("DeleteUnitService", () => {
  const service = new DeleteUnitService()

  it("throws NotFoundError when the unit does not exist", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute("missing")).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError listing the relations still holding records", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({
      id: "u1",
      _count: { children: 0, firefighters: 3, vehicles: 0, crews: 0, shifts: 0, occurrences: 1 }
    })

    await expect(service.execute("u1")).rejects.toThrow("firefighters: 3, occurrences: 1")
  })

  it("deletes the unit when it has no linked records", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({
      id: "u1",
      _count: { children: 0, firefighters: 0, vehicles: 0, crews: 0, shifts: 0, occurrences: 0 }
    })
    mockPrisma.unit.delete.mockResolvedValueOnce(undefined)

    await service.execute("u1")

    expect(mockPrisma.unit.delete).toHaveBeenCalledWith({ where: { id: "u1" } })
  })
})
