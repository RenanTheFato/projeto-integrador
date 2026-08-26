import { isValidCpf } from "../../../src/utils/cpf.js"

describe("isValidCpf", () => {
  it("accepts a CPF with correct check digits", () => {
    expect(isValidCpf("52998224725")).toBe(true)
  })

  it("rejects a string that is not exactly 11 digits", () => {
    expect(isValidCpf("1234567890")).toBe(false)
    expect(isValidCpf("123456789012")).toBe(false)
    expect(isValidCpf("")).toBe(false)
  })

  it("rejects non-numeric characters", () => {
    expect(isValidCpf("529.982.247-25")).toBe(false)
    expect(isValidCpf("5299822472a")).toBe(false)
  })

  it("rejects sequences of one repeated digit even when 11 digits long", () => {
    expect(isValidCpf("11111111111")).toBe(false)
    expect(isValidCpf("00000000000")).toBe(false)
  })

  it("rejects a well-formed but fake-looking number with wrong check digits", () => {
    expect(isValidCpf("12345678900")).toBe(false)
  })

  it("rejects a CPF whose second check digit alone is wrong", () => {
    // 52998224725 is valid; flipping only the last digit must fail.
    expect(isValidCpf("52998224726")).toBe(false)
  })

  it("rejects a CPF whose first check digit alone is wrong", () => {
    expect(isValidCpf("52998224815")).toBe(false)
  })
})
