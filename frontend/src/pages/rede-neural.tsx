/**
 * The model's own screen: what is loaded, and the training that replaces it.
 *
 * Training is an administrative action — it overwrites the checkpoint every
 * dispatch depends on, with no rollback — so the button is only offered to an
 * ADMIN and the warning is stated plainly rather than buried.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, Brain, ChartLine, History, Play } from "lucide-react"

import { ai } from "@/api/endpoints"
import { TRAINING_STATUS_LABEL, TRAINING_STATUS_TONE } from "@/api/labels"
import type { TrainingRun } from "@/api/types"
import {
  ActionButton, Badge, Cell, Field, FieldButton, Page, PageHeader, Pagination, Panel, Row, Table,
  TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, LoadingBlock } from "@/components/layout/feedback"
import {
  ConvergenceSpeed, EpochsVsQuality, LossCurve, RunComparison,
} from "@/components/charts/training-charts"
import { useAuth } from "@/auth/auth-context"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatDateTime, formatLoss } from "@/lib/format"

/** The bar a run has to clear to be worth keeping, per the project's README. */
const GOOD_VALIDATION_LOSS = 0.06

export default function RedeNeural() {
  const { can } = useAuth()
  const isAdmin = can(["ADMIN"])

  const [page, setPage] = useState(1)
  const [epochs, setEpochs] = useState("800")
  const [watching, setWatching] = useState<string | null>(null)

  const model = useResource(() => ai.model(), [])
  const history = useResource(() => ai.listTrainings({ page, per_page: 10 }), [page])
  const start = useMutation((value: number) => ai.startTraining(value))

  const live = useResource(
    () => ai.getTraining(watching as string),
    [watching],
    { enabled: Boolean(watching) },
  )

  // A run takes minutes; the backend mirrors the Python job into Postgres and
  // this poll is what pulls the progress forward.
  const liveReload = live.reload
  const liveStatus = live.data?.status

  useEffect(() => {
    if (!watching) return
    if (liveStatus === "CONCLUIDO" || liveStatus === "FALHOU") {
      history.reload()
      model.reload()
      return
    }

    const timer = window.setInterval(liveReload, 4000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, liveStatus, liveReload])

  const runs = history.data?.items ?? []

  // The charts follow the table: clicking a row watches that run, and what is
  // watched is what is drawn. With nothing picked, the newest run is the one
  // anybody opening this screen wants to see.
  const selectedRun = live.data ?? runs[0] ?? null

  async function handleStart() {
    const run = await start.run(Number(epochs))
    if (run) {
      setWatching(run.id)
      history.reload()
    }
  }

  return (
    <Page>
      <PageHeader
        title="Rede neural"
        subtitle="Estado do modelo que pondera as ruas e histórico de treinamentos"
      />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Panel title="Modelo carregado" icon={<Brain className="h-5 w-5" />}>
          {model.loading && <LoadingBlock label="Consultando o serviço de IA..." />}
          {model.error && <ErrorBox message={model.error} onRetry={model.reload} />}

          {model.data && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Badge tone={model.data.loaded ? "bg-green-600" : "bg-[#DE5656]"}>
                  {model.data.loaded ? "Carregado" : "Indisponível"}
                </Badge>
                <span className="text-neutral-700">{model.data.city}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Figure label="Nós do grafo" value={model.data.graph_nodes.toLocaleString("pt-BR")} />
                <Figure label="Ruas (arestas)" value={model.data.graph_edges.toLocaleString("pt-BR")} />
              </div>

              <div className="border bg-[#F5EFE6] px-4 py-2">
                <p className="text-sm text-neutral-600">Versão do modelo</p>
                <p className="font-mono text-neutral-900">{model.data.model_version ?? "—"}</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Treinar o modelo" icon={<Play className="h-5 w-5" />}>
          {!isAdmin && (
            <p className="text-neutral-600">
              Apenas administradores podem iniciar um treinamento.
            </p>
          )}

          {isAdmin && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 border border-[#E8A240] bg-[#E8A240]/15 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#E8A240]" />
                <p className="text-neutral-900">
                  O treinamento <strong>substitui o modelo atual</strong> mesmo que o resultado seja pior,
                  e não há como voltar atrás. Faça uma cópia de <code>models/path_network.pth</code> antes.
                </p>
              </div>

              {start.error && <ErrorBox message={start.error} />}

              {/* The hint used to live inside the field, and a hint is wider
                  than a four-digit number: it stretched the column and left the
                  button floating away from the input it belongs to. It reads
                  below the row instead. */}
              <div className="flex flex-wrap items-start gap-3">
                <Field label="Épocas">
                  <TextInput
                    type="number"
                    min={10}
                    max={5000}
                    value={epochs}
                    onChange={(event) => setEpochs(event.target.value)}
                    className="w-32"
                  />
                </Field>

                <FieldButton>
                  <ActionButton tone="primary" onClick={handleStart} disabled={start.submitting}>
                    <Play className="h-5 w-5" />
                    {start.submitting ? "Iniciando..." : "Iniciar treinamento"}
                  </ActionButton>
                </FieldButton>
              </div>

              <p className="text-sm text-neutral-500">
                Entre 10 e 5000 épocas — o padrão do projeto é 800. O treinador só reporta
                progresso a cada 50, então corridas muito curtas terminam sem nenhuma medição.
              </p>

              {watching && live.data && <LiveRun run={live.data} />}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Evolução dos treinamentos" icon={<ChartLine className="h-5 w-5" />}>
        {history.loading && !history.data && <LoadingBlock label="Carregando o histórico..." />}

        {selectedRun && (
          <div className="grid gap-8 xl:grid-cols-2 xl:gap-6">
            <LossCurve run={selectedRun} previous={runs} />

            <RunComparison
              runs={runs}
              threshold={GOOD_VALIDATION_LOSS}
              selectedId={selectedRun.id}
              onSelect={setWatching}
            />

            <EpochsVsQuality
              runs={runs}
              threshold={GOOD_VALIDATION_LOSS}
              selectedId={selectedRun.id}
              onSelect={setWatching}
            />

            <ConvergenceSpeed runs={runs} threshold={GOOD_VALIDATION_LOSS} />
          </div>
        )}

        {selectedRun && (
          <p className="text-sm text-neutral-500">
            Clique numa coluna, numa bolha ou numa linha do histórico abaixo para ver a curva
            daquele treinamento.
          </p>
        )}
      </Panel>

      <Panel title="Histórico de treinamentos" icon={<History className="h-5 w-5" />}>
        {history.loading && !history.data && <LoadingBlock />}
        {history.error && <ErrorBox message={history.error} onRetry={history.reload} />}

        {history.data && history.data.items.length === 0 && (
          <EmptyState title="Nenhum treinamento registrado" />
        )}

        {history.data && history.data.items.length > 0 && (
          <>
            <Table headers={["Situação", "Épocas", "Loss treino", "Loss validação", "Início", "Fim"]}>
              {history.data.items.map((run) => (
                <Row key={run.id} onClick={() => setWatching(run.id)}>
                  <Cell>
                    <Badge tone={TRAINING_STATUS_TONE[run.status]}>{TRAINING_STATUS_LABEL[run.status]}</Badge>
                    {run.error_message && (
                      <span className="mt-1 block max-w-md truncate text-sm text-[#DE5656]" title={run.error_message}>
                        {run.error_message}
                      </span>
                    )}
                  </Cell>
                  <Cell title={run.current_epoch !== null ? "Última época reportada de quantas foram pedidas" : undefined}>
                    {run.current_epoch !== null && run.current_epoch < run.epochs
                      ? `${run.current_epoch} de ${run.epochs}`
                      : run.epochs}
                  </Cell>
                  <Cell>{formatLoss(run.train_loss)}</Cell>
                  <Cell>
                    <span className={qualityTone(run.best_validation_loss)}>
                      {formatLoss(run.best_validation_loss ?? run.validation_loss)}
                    </span>
                  </Cell>
                  <Cell className="whitespace-nowrap">{formatDateTime(run.started_at)}</Cell>
                  <Cell className="whitespace-nowrap">{formatDateTime(run.finished_at)}</Cell>
                </Row>
              ))}
            </Table>

            <Pagination
              page={history.data.page}
              perPage={history.data.per_page}
              total={history.data.total}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </Page>
  )
}

function Figure({ label, value }: { label: string, value: string }) {
  return (
    <div className="border bg-white px-4 py-3">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  )
}

function LiveRun({ run }: { run: TrainingRun }) {
  const running = run.status === "PENDENTE" || run.status === "EXECUTANDO"

  return (
    <div className="flex flex-col gap-2 border bg-[#F5EFE6] px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-neutral-900">Execução acompanhada</p>
        <Badge tone={TRAINING_STATUS_TONE[run.status]}>{TRAINING_STATUS_LABEL[run.status]}</Badge>
      </div>

      <EpochProgress run={run} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Loss treino" value={formatLoss(run.train_loss)} />
        <Metric label="Loss validação" value={formatLoss(run.validation_loss)} />
        <Metric label="Melhor validação" value={formatLoss(run.best_validation_loss)} />
      </div>

      {running && (
        <p className="text-sm text-neutral-600">
          O treinador reporta o progresso a cada 50 épocas, então a barra anda em degraus.
          A corrida também pode parar antes do fim por <em>early stopping</em>, quando a loss de
          validação deixa de melhorar.
        </p>
      )}

      {run.status === "CONCLUIDO" && run.best_validation_loss !== null && (
        <p className="text-neutral-900">
          {run.best_validation_loss <= GOOD_VALIDATION_LOSS
            ? "Resultado dentro do esperado — o serviço já recarregou este modelo."
            : `Loss de validação acima de ${GOOD_VALIDATION_LOSS}: o modelo ficou pior que o alvo do projeto.`}
        </p>
      )}

      {run.error_message && <p className="text-[#DE5656]">{run.error_message}</p>}
    </div>
  )
}

/**
 * How far along the run is.
 *
 * Until this existed the screen showed three losses and nothing else, so a run
 * of 800 epochs looked identical at epoch 50 and at epoch 750 — the numbers
 * move, but nothing says whether there are seconds or minutes left.
 */
function EpochProgress({ run }: { run: TrainingRun }) {
  const done = run.status === "CONCLUIDO" || run.status === "FALHOU"
  const reached = run.current_epoch ?? 0
  const percent = run.epochs > 0 ? Math.min(100, (reached / run.epochs) * 100) : 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-neutral-600">
          {run.current_epoch === null
            ? (done ? "Nenhuma época reportada" : "Aguardando a primeira medição...")
            : <>Época <strong className="text-neutral-900">{reached}</strong> de {run.epochs}</>}
        </p>
        <p className="text-sm font-semibold text-neutral-700">
          {run.current_epoch === null ? "—" : `${Math.round(percent)}%`}
        </p>
      </div>

      <div className="h-2.5 w-full border border-neutral-300 bg-white">
        <div
          className={`h-full transition-[width] duration-500 ${done ? "bg-neutral-500" : "bg-[#DE5656]"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string, value: string }) {
  return (
    <div className="border bg-white px-3 py-2">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="text-xl font-bold text-neutral-900">{value}</p>
    </div>
  )
}

function qualityTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-neutral-500"
  return value <= GOOD_VALIDATION_LOSS ? "font-bold text-green-700" : "font-bold text-[#E8A240]"
}
