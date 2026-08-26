export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/// Violacao de unicidade ou de regra de estado (ex: viatura ja empenhada).
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/// O servico Python de IA esta fora do ar ou respondeu com erro.
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}
