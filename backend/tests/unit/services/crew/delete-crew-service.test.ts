jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    crew: { findUnique: jest.fn(), delete: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { DeleteCrewService } from "../../../../src/services/crew/delete-crew-service.js"

const mockPrisma = prisma as unknown as {
  crew: { findUnique: jest.Mock, delete: jest.Mock }
}

describe("DeleteCrewService", () => {
  const service = new DeleteCrewService()

  it("throws NotFoundError when the crew does not exist", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute("missing")).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the crew is referenced by dispatches", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce({ id: "crew1", _count: { dispatches: 2 } })

    await expect(service.execute("crew1")).rejects.toThrow("Crew is referenced by 2 dispatch(es)")
  })

  it("deletes the crew when it has no dispatches", async () => {
    mockPrisma.crew.findUnique.mockResolvedValueOnce({ id: "crew1", _count: { dispatches: 0 } })
    mockPrisma.crew.delete.mockResolvedValueOnce(undefined)

    await service.execute("crew1")

    expect(mockPrisma.crew.delete).toHaveBeenCalledWith({ where: { id: "crew1" } })
  })
})
