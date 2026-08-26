jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    firefighter: { findUnique: jest.fn() },
    unit: { findUnique: jest.fn() },
    shift: { findFirst: jest.fn(), create: jest.fn() }
  }
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { CreateShiftService } from "../../../../src/services/shift/create-shift-service.js"

const mockPrisma = prisma as unknown as {
  firefighter: { findUnique: jest.Mock },
  unit: { findUnique: jest.Mock },
  shift: { findFirst: jest.Mock, create: jest.Mock }
}

const baseRequest = {
  type: "PLANTAO_24X72" as const,
  start_at: new Date("2026-02-01T08:00:00Z"),
  end_at: new Date("2026-02-02T08:00:00Z"),
  firefighter_id: "ff1",
  unit_id: "unit1"
}

describe("CreateShiftService", () => {
  const service = new CreateShiftService()

  it("throws BadRequestError when end_at is not later than start_at", async () => {
    await expect(service.execute({ ...baseRequest, end_at: baseRequest.start_at }))
      .rejects.toThrow("The end_at must be later than start_at")
  })

  it("throws NotFoundError when the firefighter does not exist", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute(baseRequest)).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the firefighter is not on active duty", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1", status: "FERIAS", war_name: "Silva" })

    await expect(service.execute(baseRequest)).rejects.toThrow("Silva is not on active duty")
  })

  it("throws NotFoundError when the unit does not exist", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1", status: "ATIVO", war_name: "Silva" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute(baseRequest)).rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the shift overlaps an existing one", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1", status: "ATIVO", war_name: "Silva" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.shift.findFirst.mockResolvedValueOnce({
      id: "existing", start_at: new Date("2026-02-01T06:00:00Z"), end_at: new Date("2026-02-01T18:00:00Z")
    })

    await expect(service.execute(baseRequest)).rejects.toThrow(ConflictError)
  })

  it("creates the shift when there is no conflict", async () => {
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1", status: "ATIVO", war_name: "Silva" })
    mockPrisma.unit.findUnique.mockResolvedValueOnce({ id: "unit1" })
    mockPrisma.shift.findFirst.mockResolvedValueOnce(null)
    mockPrisma.shift.create.mockResolvedValueOnce({ id: "shift1", ...baseRequest })

    const result = await service.execute(baseRequest)

    expect(result).toHaveProperty("id", "shift1")
  })
})
