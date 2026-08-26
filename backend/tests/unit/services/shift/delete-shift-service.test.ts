jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    shift: { findUnique: jest.fn(), delete: jest.fn() }
  }
}))

import { NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { DeleteShiftService } from "../../../../src/services/shift/delete-shift-service.js"

const mockPrisma = prisma as unknown as {
  shift: { findUnique: jest.Mock, delete: jest.Mock }
}

describe("DeleteShiftService", () => {
  const service = new DeleteShiftService()

  it("throws NotFoundError when the shift does not exist", async () => {
    mockPrisma.shift.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute("missing")).rejects.toThrow(NotFoundError)
  })

  it("deletes the shift when it exists", async () => {
    mockPrisma.shift.findUnique.mockResolvedValueOnce({ id: "shift1" })
    mockPrisma.shift.delete.mockResolvedValueOnce(undefined)

    await service.execute("shift1")

    expect(mockPrisma.shift.delete).toHaveBeenCalledWith({ where: { id: "shift1" } })
  })
})
