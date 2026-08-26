jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    unit: { findUnique: jest.fn() },
    vehicle: { findFirst: jest.fn(), create: jest.fn() }
  }
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { CreateVehicleService } from "../../../../src/services/vehicle/create-vehicle-service.js"

const mockPrisma = prisma as unknown as {
  unit: { findUnique: jest.Mock },
  vehicle: { findFirst: jest.Mock, create: jest.Mock }
}

const baseRequest = {
  prefix: "ABT-01",
  type: "ABT" as const,
  plate: "ABC1234",
  model: "Mercedes Atego",
  year: 2020,
  crew_capacity: 4,
  unit_id: "unit1"
}

describe("CreateVehicleService", () => {
  const service = new CreateVehicleService()

  it("throws NotFoundError when the unit does not exist", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute(baseRequest)).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the unit is inactive", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: false })

    await expect(service.execute(baseRequest)).rejects.toThrow("Cannot assign a vehicle to an inactive unit")
  })

  it("throws ConflictError naming the prefix when it is the duplicate field", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.vehicle.findFirst.mockResolvedValueOnce({ prefix: baseRequest.prefix })

    await expect(service.execute(baseRequest)).rejects.toThrow("prefix is already registered")
  })

  it("throws ConflictError naming the plate when it is the duplicate field", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.vehicle.findFirst.mockResolvedValueOnce({ prefix: "OTHER-PREFIX" })

    await expect(service.execute(baseRequest)).rejects.toThrow("plate is already registered")
  })

  it("throws BadRequestError when a water capacity is given for a type without a tank", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null)

    await expect(service.execute({ ...baseRequest, type: "UR", water_capacity_liters: 1000 }))
      .rejects.toThrow("A UR does not carry a water tank")
  })

  it("creates the vehicle when a tank-type carries a water capacity", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null)
    mockPrisma.vehicle.create.mockResolvedValueOnce({ id: "v1", ...baseRequest, water_capacity_liters: 3000 })

    const result = await service.execute({ ...baseRequest, water_capacity_liters: 3000 })

    expect(result).toHaveProperty("id", "v1")
  })

  it("creates the vehicle without a water capacity for a non-tank type", async () => {
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1", active: true })
    mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null)
    mockPrisma.vehicle.create.mockResolvedValueOnce({ id: "v2", ...baseRequest, type: "UR", water_capacity_liters: null })

    await service.execute({ ...baseRequest, type: "UR" })

    expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ water_capacity_liters: null })
    })
  })
})
