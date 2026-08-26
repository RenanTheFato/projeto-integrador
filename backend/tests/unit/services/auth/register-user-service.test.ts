jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    firefighter: { findUnique: jest.fn() }
  }
}))

jest.mock("../../../../src/utils/password.js", () => ({
  hashPassword: jest.fn()
}))

import { BadRequestError, ConflictError, NotFoundError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import { hashPassword } from "../../../../src/utils/password.js"
import { RegisterUserService } from "../../../../src/services/auth/register-user-service.js"

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock, create: jest.Mock },
  firefighter: { findUnique: jest.Mock }
}
const hashPasswordMock = hashPassword as jest.Mock

describe("RegisterUserService", () => {
  const service = new RegisterUserService()

  const baseRequest = {
    email: "new@bombeiros.local",
    password: "12345678",
    role: "OPERADOR" as const
  }

  it("throws ConflictError when the e-mail is already registered", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "existing" })

    await expect(service.execute(baseRequest)).rejects.toThrow(ConflictError)
  })

  it("throws NotFoundError when firefighter_id does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ ...baseRequest, firefighter_id: "ff1" }))
      .rejects.toThrow(NotFoundError)
  })

  it("throws ConflictError when the firefighter already has an account", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce({ id: "other-user" }) // firefighter_id already linked
    mockPrisma.firefighter.findUnique.mockResolvedValueOnce({ id: "ff1" })

    await expect(service.execute({ ...baseRequest, firefighter_id: "ff1" }))
      .rejects.toThrow("This firefighter already has an account")
  })

  it("throws BadRequestError when the password is shorter than 8 characters", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)

    await expect(service.execute({ ...baseRequest, password: "1234567" }))
      .rejects.toThrow(BadRequestError)
  })

  it("creates the user with a hashed password and no plaintext leak", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    hashPasswordMock.mockResolvedValueOnce("hashed-password")
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "u1", email: baseRequest.email, role: baseRequest.role, firefighter_id: null
    })

    const result = await service.execute(baseRequest)

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: baseRequest.email,
        password_hash: "hashed-password",
        role: baseRequest.role,
        firefighter_id: null
      },
      omit: { password_hash: true }
    })
    expect(result).not.toHaveProperty("password_hash")
  })
})
