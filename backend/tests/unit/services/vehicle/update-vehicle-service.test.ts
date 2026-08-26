jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    vehicle: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    dispatch: { findFirst: jest.fn() },
    unit: { findUnique: jest.fn() }
  }
}))

import { ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { UpdateVehicleService } from "../../../../src/services/vehicle/update-vehicle-service.js"

const mockPrisma = prisma as unknown as {
  vehicle: { findUnique: jest.Mock, findFirst: jest.Mock, update: jest.Mock },
  dispatch: { findFirst: jest.Mock },
  unit: { findUnique: jest.Mock }
}

describe("UpdateVehicleService", () => {
  const service = new UpdateVehicleService()

  it("throws NotFoundError when the vehicle does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ id: "missing" })).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the new prefix or plate belongs to another vehicle", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", status: "DISPONIVEL" })
    mockPrisma.vehicle.findFirst.mockResolvedValueOnce({ prefix: "TAKEN" })

    await expect(service.execute({ id: "v1", prefix: "TAKEN" })).rejects.toThrow(ConflictError)
  })

  it("throws ConflictError when moving an EMPENHADA vehicle away while a dispatch is still open", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", status: "EMPENHADA" })
    mockPrisma.dispatch.findFirst.mockResolvedValueOnce({ id: "d1" })

    await expect(service.execute({ id: "v1", status: "MANUTENCAO" }))
      .rejects.toThrow("This vehicle is assigned to an open dispatch. Finish or cancel it first.")
  })

  it("allows moving an EMPENHADA vehicle to MANUTENCAO once no dispatch is open", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", status: "EMPENHADA" })
    mockPrisma.dispatch.findFirst.mockResolvedValueOnce(null)
    mockPrisma.vehicle.update.mockResolvedValueOnce({ id: "v1", status: "MANUTENCAO" })

    await expect(service.execute({ id: "v1", status: "MANUTENCAO" })).resolves.toBeDefined()
  })

  it("does not check for open dispatches when the vehicle is not currently EMPENHADA", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", status: "DISPONIVEL" })
    mockPrisma.vehicle.update.mockResolvedValueOnce({ id: "v1", status: "MANUTENCAO" })

    await service.execute({ id: "v1", status: "MANUTENCAO" })

    expect(mockPrisma.dispatch.findFirst).not.toHaveBeenCalled()
  })

  it("throws NotFoundError when transferring to a unit that does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", status: "DISPONIVEL" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ id: "v1", unit_id: "missing-unit" })).rejects.toThrow(NotFoundError)
  })
})
