import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../@types/fastify-types.js";
import { CalculateRouteController } from "../controllers/ai/calculate-route-controller.js";
import { GetTrainingController, ListTrainingsController, ModelInfoController, StartTrainingController } from "../controllers/ai/training-controller.js";

export async function aiRoutes(fastify: FastifyTypedInstance, plugins: FastifyPluginOptions) {

  fastify.post("/routes", async (req: FastifyRequest, rep: FastifyReply) => {
    return new CalculateRouteController().handle(req, rep)
  })

  fastify.get("/model", async (req: FastifyRequest, rep: FastifyReply) => {
    return new ModelInfoController().handle(req, rep)
  })

  // Retraining rewrites the model every dispatch depends on, so it is fired
  // from the neural network screen and never as a side effect of a request.
  fastify.post("/training", async (req: FastifyRequest, rep: FastifyReply) => {
    return new StartTrainingController().handle(req, rep)
  })

  fastify.get("/training", async (req: FastifyRequest, rep: FastifyReply) => {
    return new ListTrainingsController().handle(req, rep)
  })

  fastify.get("/training/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    return new GetTrainingController().handle(req, rep)
  })
}
