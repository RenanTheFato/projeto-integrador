import { hashPassword, verifyPassword } from "../../../src/utils/password.js"

describe("hashPassword / verifyPassword", () => {
  it("produces a hash that verifies against the original plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery-staple")

    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true)
  })

  it("rejects a wrong plaintext against an existing hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple")

    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false)
  })

  it("never stores the plaintext in the hash output", async () => {
    const plain = "correct-horse-battery-staple"
    const hash = await hashPassword(plain)

    expect(hash).not.toBe(plain)
    expect(hash.includes(plain)).toBe(false)
  })

  it("produces different hashes for the same input due to the salt", async () => {
    const hashA = await hashPassword("same-password")
    const hashB = await hashPassword("same-password")

    expect(hashA).not.toBe(hashB)
  })
})
