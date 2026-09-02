import { z } from "zod/v4";
import dotenv from 'dotenv';

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  HOST: z.coerce.string().default("0.0.0.0"),

  DATABASE_URL: z.string({ error: "DATABASE_URL is required" }),

  // Servico Python (FastAPI) que calcula rotas e executa o treinamento.
  AI_SERVICE_URL: z.string().default("http://127.0.0.1:8000"),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().default(120000)
})

export const env = envSchema.parse(process.env)
