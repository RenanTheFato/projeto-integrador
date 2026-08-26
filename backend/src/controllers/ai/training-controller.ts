import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import { GetTrainingService, ListTrainingsService, StartTrainingService } from "../../services/ai/training-service.js";
import { AiClient } from "../../services/ai/ai-client.js";
import { handleError } from "../../errors/handle-error.js";

export class StartTrainingController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const trainingSchema = z.object({
      epochs: z.coerce.number({ error: "The value must be a number for epochs" })
        .int({ error: "The epochs must be an integer" })
        .min(10, { error: "Training with fewer than 10 epochs is not useful" })
        .max(5000, { error: "The epochs cannot exceed 5000" })
        .default(800)
    })

    try {
      const { epochs } = trainingSchema.parse(req.body ?? {})

      const startTrainingService = new StartTrainingService()
      const run = await startTrainingService.execute(epochs)

      return rep.status(202).send({ message: "Training started", run })
    } catch (error: unknown) {
      return handleError(error, rep, "Training")
    }
  }
}

export class GetTrainingController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const paramsSchema = z.object({
      id: z.uuid({ error: "The id must be a valid uuid" })
    })

    try {
      const { id } = paramsSchema.parse(req.params)

      const getTrainingService = new GetTrainingService()
      const run = await getTrainingService.execute(id)

      return rep.status(200).send({ run })
    } catch (error: unknown) {
      return handleError(error, rep, "Training")
    }
  }
}

export class ListTrainingsController {
  async handle(req: FastifyRequest, rep: FastifyReply) {

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20)
    })

    try {
      const query = querySchema.parse(req.query)

      const listTrainingsService = new ListTrainingsService()
      const result = await listTrainingsService.execute(query)

      return rep.status(200).send(result)
    } catch (error: unknown) {
      return handleError(error, rep, "Training")
    }
  }
}

export class ModelInfoController {
  async handle(req: FastifyRequest, rep: FastifyReply) {
    try {
      const info = await new AiClient().getModelInfo()

      return rep.status(200).send({ model: info })
    } catch (error: unknown) {
      return handleError(error, rep, "Model")
    }
  }
}
