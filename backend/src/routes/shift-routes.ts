import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateShiftController } from "../controllers/shift/create-shift-controller.js";
import { ListShiftsController } from "../controllers/shift/list-shifts-controller.js";
import { UpdateShiftController } from "../controllers/shift/update-shift-controller.js";
import { DeleteShiftController } from "../controllers/shift/delete-shift-controller.js";

export async function shiftRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListShiftsController().handle(req, rep)
  })

  fastify.post("/", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateShiftController().handle(req, rep)
  })

  fastify.patch("/:id", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateShiftController().handle(req, rep)
  })

  fastify.delete("/:id", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new DeleteShiftController().handle(req, rep)
  })
}
