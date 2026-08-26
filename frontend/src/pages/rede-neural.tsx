/**
 * The model's own screen: what is loaded, and the training that replaces it.
 *
 * Training is an administrative action — it overwrites the checkpoint every
 * dispatch depends on, with no rollback — so the button is only offered to an
 * ADMIN and the warning is stated plainly rather than buried.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, Brain, History, Play } from "lucide-react"

import { ai } from "@/api/endpoints"
import { TRAINING_STATUS_LABEL, TRAINING_STATUS_TONE } from "@/api/labels"
import type { TrainingRun } from "@/api/types"
import {
  ActionButton, Badge, Cell, Field, Page, PageHeader, Pagination, Panel, Row, Table, TextInput,
} from "@/components/layout/kit"
import { EmptyState, ErrorBox, LoadingBlock } from "@/components/layout/feedback"
import { useAuth } from "@/auth/auth-context"
import { useMutation, useResource } from "@/hooks/use-resource"
import { formatDateTime } from "@/lib/format"

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

      <div className="grid gap-5 xl:grid-cols-2">
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="flex flex-wrap items-end gap-3">
                <Field label="Épocas" hint="Entre 10 e 5000. O padrão do projeto é 800.">
                  <TextInput
                    type="number"
                    min={10}
                    max={5000}
                    value={epochs}
                    onChange={(event) => setEpochs(event.target.value)}
                    className="w-32"
                  />
                </Field>

                <ActionButton tone="primary" onClick={handleStart} disabled={start.submitting}>
                  <Play className="h-5 w-5" />
                  {start.submitting ? "Iniciando..." : "Iniciar treinamento"}
                </ActionButton>
              </div>

              {watching && live.data && <LiveRun run={live.data} />}
            </div>
          )}
        </Panel>
      </div>

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
                  <Cell>{run.epochs}</Cell>
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

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Loss treino" value={formatLoss(run.train_loss)} />
        <Metric label="Loss validação" value={formatLoss(run.validation_loss)} />
        <Metric label="Melhor validação" value={formatLoss(run.best_validation_loss)} />
      </div>

      {running && (
        <p className="text-sm text-neutral-600">
          O treinador imprime as métricas a cada 50 épocas; corridas curtas podem terminar sem
          nenhuma linha de progresso.
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

function Metric({ label, value }: { label: string, value: string }) {
  return (
    <div className="border bg-white px-3 py-2">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="text-xl font-bold text-neutral-900">{value}</p>
    </div>
  )
}

function formatLoss(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toFixed(4).replace(".", ",")
}

function qualityTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-neutral-500"
  return value <= GOOD_VALIDATION_LOSS ? "font-bold text-green-700" : "font-bold text-[#E8A240]"
}
