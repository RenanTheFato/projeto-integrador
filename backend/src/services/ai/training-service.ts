import { TrainingRun } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../errors/index.js";
import { AiClient } from "./ai-client.js";

export class StartTrainingService {
  async execute(epochs: number): Promise<TrainingRun> {

    // Two concurrent trainings would fight over the same .pth file.
    const running = await prisma.trainingRun.findFirst({
      where: { status: { in: ["PENDENTE", "EXECUTANDO"] } },
      select: { id: true }
    })

    if (running) {
      throw new ConflictError("A training run is already in progress")
    }

    const job = await new AiClient().startTraining(epochs)

    return prisma.trainingRun.create({
      data: {
        epochs,
        status: job.status,
        external_job_id: job.job_id,
        started_at: job.started_at ? new Date(job.started_at) : null
      }
    })
  }
}

/// Reads the live progress from the Python side and mirrors it into the
/// database. Polled by the client while a run is in flight.
export class GetTrainingService {
  async execute(id: string): Promise<TrainingRun> {

    const run = await prisma.trainingRun.findUnique({ where: { id } })

    if (!run) {
      throw new NotFoundError("Training run not found")
    }

    if (!run.external_job_id || run.status === "CONCLUIDO" || run.status === "FALHOU") {
      return run
    }

    try {
      const job = await new AiClient().getTraining(run.external_job_id)

      return prisma.trainingRun.update({
        where: { id },
        data: {
          status: job.status,
          train_loss: job.train_loss,
          validation_loss: job.validation_loss,
          best_validation_loss: job.best_validation_loss,
          started_at: job.started_at ? new Date(job.started_at) : run.started_at,
          finished_at: job.finished_at ? new Date(job.finished_at) : null,
          error_message: job.error_message,
          model_path: job.model_path
        }
      })
    } catch (error) {
      // The Python service keeps its jobs in memory only. A 404 means it was
      // restarted while this run was in flight, so the job is gone and will
      // never progress. Leaving the row as EXECUTANDO would block every future
      // training with a 409 and there is no endpoint to clear it by hand.
      if (error instanceof NotFoundError) {
        return prisma.trainingRun.update({
          where: { id },
          data: {
            status: "FALHOU",
            finished_at: new Date(),
            error_message: "The AI service no longer knows this job. It was most likely restarted while the run was in progress."
          }
        })
      }

      // A transient AI outage should not hide the run we already know about.
      console.error(`Could not refresh training run ${id}:`, error)
      return run
    }
  }
}

export class ListTrainingsService {
  async execute({ page, per_page }: { page: number, per_page: number }) {

    const [runs, total] = await Promise.all([
      prisma.trainingRun.findMany({
        orderBy: { created_at: "desc" },
        skip: (page - 1) * per_page,
        take: per_page
      }),
      prisma.trainingRun.count()
    ])

    return { runs, total, page, per_page }
  }
}
