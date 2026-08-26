import { User, UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/index.js";
import { hashPassword } from "../../utils/password.js";

interface RegisterUserRequest {
  email: string,
  password: string,
  role: UserRole,
  firefighter_id?: string
}

export class RegisterUserService {
  async execute({ email, password, role, firefighter_id }: RegisterUserRequest): Promise<Omit<User, 'password_hash'>> {

    const userAlreadyExists = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })

    if (userAlreadyExists) {
      throw new ConflictError("E-mail already registered")
    }

    if (firefighter_id) {
      const firefighter = await prisma.firefighter.findUnique({
        where: { id: firefighter_id },
        select: { id: true }
      })

      if (!firefighter) {
        throw new NotFoundError("Firefighter not found")
      }

      const alreadyLinked = await prisma.user.findUnique({
        where: { firefighter_id },
        select: { id: true }
      })

      if (alreadyLinked) {
        throw new ConflictError("This firefighter already has an account")
      }
    }

    if (password.length < 8) {
      throw new BadRequestError("The password must be at least 8 characters long")
    }

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: await hashPassword(password),
        role,
        firefighter_id: firefighter_id ?? null
      },
      omit: {
        password_hash: true
      }
    })

    return user
  }
}
