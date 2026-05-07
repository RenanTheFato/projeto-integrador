import { fastify, FastifyError } from "fastify";
import { fastifyCors } from "@fastify/cors";
import { fastifyCookie } from "@fastify/cookie";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import dotenv from 'dotenv';

dotenv.config()

const HTTP_PORT = env.PORT
const HTTP_HOST = env.HOST

const server = fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

async function start(): Promise<void> {
  await server.register(fastifyCors)
  await server.register(fastifyCookie)

  server.listen({
    host: HTTP_HOST,
    port: HTTP_PORT
  }).then(() => {
    console.log(`HTTP SERVER RUNNING ON PORT ${HTTP_PORT}`)
  }).catch((err: FastifyError) => {
    console.error(`ERROR ON TRYING TO RUN THE HTTP SERVER: ${err}`)
    process.exit(1)
  })
}

start()