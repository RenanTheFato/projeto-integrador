import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

import dotenv from "dotenv";

dotenv.config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!
})

export const prisma = new PrismaClient({ adapter })
