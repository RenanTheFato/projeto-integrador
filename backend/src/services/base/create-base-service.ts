import { Base } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { BadRequestError } from "../../errors/index.js";

export class CreateBaseService {
  async execute({ name, address, latitude, longitude, phone }: Omit<Base, 'id' | 'created_at' | 'updated_at'>): Promise<Base> {

    const baseAlreadyExists = await prisma.base.findFirst({
      where: {
        name,
      },
      select: {
        name: true,
      }
    })

    if (baseAlreadyExists) {
      throw new BadRequestError("Base already registered")
    }

    const base = await prisma.base.create({
      data: {
        name,
        address,
        latitude,
        longitude,
        phone
      }
    })

    return base

  }
}