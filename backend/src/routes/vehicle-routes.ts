import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CreateVehicleController } from "../controllers/vehicle/create-vehicle-controller.js";
import { ListVehiclesController } from "../controllers/vehicle/list-vehicles-controller.js";
import { GetVehicleController } from "../controllers/vehicle/get-vehicle-controller.js";
import { UpdateVehicleController } from "../controllers/vehicle/update-vehicle-controller.js";
import { DeleteVehicleController } from "../controllers/vehicle/delete-vehicle-controller.js";

export async function vehicleRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.get("/", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListVehiclesController().handle(req, rep)
  })

  fastify.get("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetVehicleController().handle(req, rep)
  })

  fastify.post("/", { onRequest: [fastify.authorize(["ADMIN", "COMANDANTE"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CreateVehicleController().handle(req, rep)
  })

  // Dispatchers update status and live position, so OPERADOR is allowed here.
  fastify.patch("/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new UpdateVehicleController().handle(req, rep)
  })

  fastify.delete("/:id", { onRequest: [fastify.authorize(["ADMIN"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new DeleteVehicleController().handle(req, rep)
  })
}
