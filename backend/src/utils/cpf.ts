/// Validation of a Brazilian CPF by its two check digits.
///
/// Checking only that the string has 11 digits lets obviously fake numbers in:
/// `11111111111` and `12345678900` are both eleven digits and neither is a CPF
/// anyone could hold. Since the number identifies a real firefighter and is
/// unique in the database, a typo accepted here is a record that has to be
/// fixed by hand later.
///
/// The number is expected already stripped of punctuation — the schema rejects
/// anything that is not exactly 11 digits before this runs.

/// Sequences of one repeated digit satisfy the check-digit arithmetic, so they
/// have to be excluded explicitly.
const REPEATED_DIGITS = /^(\d)\1{10}$/

/// Each check digit is the weighted sum of the digits before it, modulo 11.
/// A remainder below 2 means the digit is 0, otherwise it is 11 minus it.
function checkDigit(digits: number[], length: number): number {
  let sum = 0

  for (let i = 0; i < length; i++) {
    sum += digits[i] * (length + 1 - i)
  }

  const remainder = sum % 11

  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || REPEATED_DIGITS.test(cpf)) {
    return false
  }

  const digits = cpf.split("").map(Number)

  return checkDigit(digits, 9) === digits[9]
    && checkDigit(digits, 10) === digits[10]
}
