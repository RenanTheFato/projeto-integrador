jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    vehicle: { findUnique: jest.fn(), delete: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { DeleteVehicleService } from "../../../../src/services/vehicle/delete-vehicle-service.js"

const mockPrisma = prisma as unknown as {
  vehicle: { findUnique: jest.Mock, delete: jest.Mock }
}

describe("DeleteVehicleService", () => {
  const service = new DeleteVehicleService()

  it("throws NotFoundError when the vehicle does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute("missing")).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the vehicle still has linked crews or dispatches", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({
      id: "v1", _count: { crews: 1, dispatches: 2 }
    })

    await expect(service.execute("v1")).rejects.toThrow("crews: 1, dispatches: 2")
  })

  it("deletes the vehicle when it has no linked records", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({
      id: "v1", _count: { crews: 0, dispatches: 0 }
    })
    mockPrisma.vehicle.delete.mockResolvedValueOnce(undefined)

    await service.execute("v1")

    expect(mockPrisma.vehicle.delete).toHaveBeenCalledWith({ where: { id: "v1" } })
  })
})
