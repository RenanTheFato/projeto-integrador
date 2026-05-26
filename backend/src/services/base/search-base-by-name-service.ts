import { Base } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { NotFoundError } from "../../errors/index.js";

export class SearchBaseByNameService {
  async execute({ name }: Pick<Base, 'name'>): Promise<Base[]> {
    const bases = await prisma.base.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    })

    if (bases.length === 0) {
      throw new NotFoundError(`No base found containing ${name}`)
    }

    return bases
  }
}