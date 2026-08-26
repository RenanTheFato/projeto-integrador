import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CalculateRouteController } from "../controllers/ai/calculate-route-controller.js";
import { GetTrainingController, ListTrainingsController, ModelInfoController, StartTrainingController } from "../controllers/ai/training-controller.js";

export async function aiRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.post("/routes", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new CalculateRouteController().handle(req, rep)
  })

  fastify.get("/model", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ModelInfoController().handle(req, rep)
  })

  // Retraining rewrites the model every dispatch depends on, so it is an
  // administrative action, not a dispatcher one.
  fastify.post("/training", { onRequest: [fastify.authorize(["ADMIN"])] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new StartTrainingController().handle(req, rep)
  })

  fastify.get("/training", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListTrainingsController().handle(req, rep)
  })

  fastify.get("/training/:id", { onRequest: [fastify.authenticate] }, async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetTrainingController().handle(req, rep)
  })
}
