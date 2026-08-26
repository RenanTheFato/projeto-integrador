jest.mock("../../../../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}))

jest.mock("../../../../src/utils/password.js", () => ({
  verifyPassword: jest.fn()
}))

import { UnauthorizedError } from "../../../../src/errors/index.js"
import { prisma } from "../../../../src/config/prisma.js"
import * as password from "../../../../src/utils/password.js"
import { AuthenticateUserService } from "../../../../src/services/auth/authenticate-user-service.js"

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock, update: jest.Mock }
}
const verifyPasswordMock = password.verifyPassword as jest.Mock

describe("AuthenticateUserService", () => {
  const service = new AuthenticateUserService()

  it("throws UnauthorizedError when the e-mail is not registered, without revealing that", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await expect(service.execute({ email: "ghost@bombeiros.local", password: "whatever1" }))
      .rejects.toThrow(UnauthorizedError)
    await expect(service.execute({ email: "ghost@bombeiros.local", password: "whatever1" }))
      .rejects.toThrow("Invalid credentials")
  })

  it("throws the same UnauthorizedError message when the password is wrong", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", email: "admin@bombeiros.local", password_hash: "hash", active: true, role: "ADMIN"
    })
    verifyPasswordMock.mockResolvedValue(false)

    await expect(service.execute({ email: "admin@bombeiros.local", password: "wrong" }))
      .rejects.toThrow("Invalid credentials")
  })

  it("throws UnauthorizedError when the account is disabled", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", email: "admin@bombeiros.local", password_hash: "hash", active: false, role: "ADMIN"
    })
    verifyPasswordMock.mockResolvedValue(true)

    await expect(service.execute({ email: "admin@bombeiros.local", password: "correct1" }))
      .rejects.toThrow("This account is disabled")
  })

  it("returns the JWT payload and records last_login_at on success", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1", email: "admin@bombeiros.local", password_hash: "hash", active: true, role: "ADMIN"
    })
    verifyPasswordMock.mockResolvedValue(true)
    mockPrisma.user.update.mockResolvedValue({})

    const result = await service.execute({ email: "admin@bombeiros.local", password: "correct1" })

    expect(result).toEqual({ sub: "u1", email: "admin@bombeiros.local", role: "ADMIN" })
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { last_login_at: expect.any(Date) }
    })
  })
})
