import { z } from "zod/v4";
import dotenv from 'dotenv';

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  HOST: z.coerce.string().default("0.0.0.0")
})

export const env = envSchema.parse(process.env)