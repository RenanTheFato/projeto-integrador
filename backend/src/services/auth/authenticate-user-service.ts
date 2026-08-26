import { prisma } from "../../config/prisma.js";
import { UnauthorizedError } from "../../errors/index.js";
import { TokenPayload } from "../../@types/fastify-types.js";
import { verifyPassword } from "../../utils/password.js";

interface AuthenticateUserRequest {
  email: string,
  password: string
}

export class AuthenticateUserService {
  async execute({ email, password }: AuthenticateUserRequest): Promise<TokenPayload> {

    const user = await prisma.user.findUnique({
      where: { email }
    })

    // A mesma mensagem para e-mail inexistente e senha errada, para nao
    // revelar quais e-mails estao cadastrados.
    if (!user) {
      throw new UnauthorizedError("Invalid credentials")
    }

    const passwordMatches = await verifyPassword(password, user.password_hash)

    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid credentials")
    }

    if (!user.active) {
      throw new UnauthorizedError("This account is disabled")
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() }
    })

    return {
      sub: user.id,
      email: user.email,
      role: user.role
    }
  }
}
