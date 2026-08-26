import { z } from "zod/v4"
import { handleError } from "../../../src/errors/handle-error.js"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError
} from "../../../src/errors/index.js"

function fakeReply() {
  const rep: any = {}
  rep.status = jest.fn().mockReturnValue(rep)
  rep.send = jest.fn().mockReturnValue(rep)
  return rep
}

describe("handleError", () => {
  it("maps a ZodError to 400 with a flattened issue list", () => {
    const rep = fakeReply()
    const schema = z.object({ email: z.string() })
    const result = schema.safeParse({ email: 123 })

    handleError(result.error, rep, "Create User")

    expect(rep.status).toHaveBeenCalledWith(400)
    const [body] = rep.send.mock.calls[0]
    expect(body.error).toBe("Create User Validation Error Occurred")
    expect(Array.isArray(body.errors)).toBe(true)
    expect(body.errors[0]).toHaveProperty("path", "email")
  })

  it("maps BadRequestError to 400", () => {
    const rep = fakeReply()
    handleError(new BadRequestError("bad input"), rep, "ctx")
    expect(rep.status).toHaveBeenCalledWith(400)
    expect(rep.send).toHaveBeenCalledWith({ error: "bad input" })
  })

  it("maps UnauthorizedError to 401", () => {
    const rep = fakeReply()
    handleError(new UnauthorizedError("invalid credentials"), rep, "ctx")
    expect(rep.status).toHaveBeenCalledWith(401)
    expect(rep.send).toHaveBeenCalledWith({ error: "invalid credentials" })
  })

  it("maps ForbiddenError to 403", () => {
    const rep = fakeReply()
    handleError(new ForbiddenError("not allowed"), rep, "ctx")
    expect(rep.status).toHaveBeenCalledWith(403)
    expect(rep.send).toHaveBeenCalledWith({ error: "not allowed" })
  })

  it("maps NotFoundError to 404", () => {
    const rep = fakeReply()
    handleError(new NotFoundError("missing"), rep, "ctx")
    expect(rep.status).toHaveBeenCalledWith(404)
    expect(rep.send).toHaveBeenCalledWith({ error: "missing" })
  })

  it("maps ConflictError to 409", () => {
    const rep = fakeReply()
    handleError(new ConflictError("duplicate"), rep, "ctx")
    expect(rep.status).toHaveBeenCalledWith(409)
    expect(rep.send).toHaveBeenCalledWith({ error: "duplicate" })
  })

  it("maps ServiceUnavailableError to 503", () => {
    const rep = fakeReply()
    handleError(new ServiceUnavailableError("AI service down"), rep, "ctx")
    expect(rep.status).toHaveBeenCalledWith(503)
    expect(rep.send).toHaveBeenCalledWith({ error: "AI service down" })
  })

  it("falls back to 500 for an unrecognized error and logs it", () => {
    const rep = fakeReply()
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    handleError(new Error("unexpected"), rep, "ctx")

    expect(rep.status).toHaveBeenCalledWith(500)
    expect(rep.send).toHaveBeenCalledWith({ error: "Internal Server Error" })
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
