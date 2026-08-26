jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    firefighter: { findUnique: jest.fn(), delete: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { DeleteFirefighterService } from "../../../../src/services/firefighter/delete-firefighter-service.js"

const mockPrisma = prisma as unknown as {
  firefighter: { findUnique: jest.Mock, delete: jest.Mock }
}

describe("DeleteFirefighterService", () => {
  const service = new DeleteFirefighterService()

  it("throws NotFoundError when the firefighter does not exist", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute("missing")).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError mentioning the user account when one is linked", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({
      id: "ff1",
      _count: { crew_members: 0, shifts: 0, commanded_crews: 0 },
      user: { id: "u1" }
    })

    await expect(service.execute("ff1")).rejects.toThrow("user account")
  })

  it("throws ConflictError listing operational relations still present", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({
      id: "ff1",
      _count: { crew_members: 2, shifts: 0, commanded_crews: 0 },
      user: null
    })

    await expect(service.execute("ff1")).rejects.toThrow("crew_members: 2")
  })

  it("deletes the firefighter when there is no linked record", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({
      id: "ff1",
      _count: { crew_members: 0, shifts: 0, commanded_crews: 0 },
      user: null
    })
    mockPrisma.firefighter.delete.mockResolvedValueOnce(undefined)

    await service.execute("ff1")

    expect(mockPrisma.firefighter.delete).toHaveBeenCalledWith({ where: { id: "ff1" } })
  })
})
