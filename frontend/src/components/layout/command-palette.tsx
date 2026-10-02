/**
 * Ctrl+K: go anywhere, open any occurrence, start a new one.
 *
 * A dispatcher on the phone has one free hand. The palette makes every screen
 * and every occurrence two keystrokes away — the pattern of Linear and VS Code,
 * kept to the actions this console actually has. Alt+N opens a new occurrence
 * directly, from any screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CornerDownLeft, FileText, Plus, Search } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { occurrences } from "@/api/endpoints"
import { NATURE_LABEL } from "@/api/labels"
import type { Occurrence } from "@/api/types"
import { looksLikeProtocol, rankCommands } from "@/lib/command-search"
import { OPEN_PALETTE_EVENT } from "@/lib/palette-events"
import type { Command } from "@/lib/command-search"
import { cn } from "@/lib/utils"

interface NavCommand extends Command {
  to: string
}

const COMMANDS: NavCommand[] = [
  { id: "new", label: "Nova ocorrência", keywords: ["registrar", "chamado", "abrir"], group: "Ações", to: "/ocorrencias?nova=1" },
  { id: "painel", label: "Painel", keywords: ["inicio", "dashboard"], group: "Operação", to: "/" },
  { id: "ocorrencias", label: "Ocorrências", group: "Operação", to: "/ocorrencias" },
  { id: "despachos", label: "Despachos", keywords: ["empenho"], group: "Operação", to: "/despachos" },
  { id: "rotas", label: "Rotas", keywords: ["trajeto", "interdicao", "manobras"], group: "Operação", to: "/rotas" },
  { id: "cobertura", label: "Cobertura", keywords: ["isocrona", "tempo resposta", "posto", "simular"], group: "Operação", to: "/cobertura" },
  { id: "estatisticas", label: "Estatísticas", keywords: ["indicadores", "graficos"], group: "Operação", to: "/estatisticas" },
  { id: "ia", label: "Rede neural", keywords: ["ia", "treino", "modelo"], group: "Operação", to: "/rede-neural" },
  { id: "terminal", label: "Terminal da viatura", keywords: ["mdt", "tablet", "guarnicao"], group: "Telas", to: "/terminal" },
  { id: "telao", label: "Telão do COBOM", keywords: ["wallboard", "tv", "painel grande"], group: "Telas", to: "/telao" },
  { id: "efetivo", label: "Efetivo", keywords: ["bombeiros", "militares"], group: "Cadastros", to: "/efetivo" },
  { id: "viaturas", label: "Viaturas", keywords: ["frota"], group: "Cadastros", to: "/viaturas" },
  { id: "guarnicoes", label: "Guarnições", keywords: ["equipes"], group: "Cadastros", to: "/guarnicoes" },
  { id: "turnos", label: "Turnos", keywords: ["escala", "plantao"], group: "Cadastros", to: "/turnos" },
  { id: "unidades", label: "Unidades", keywords: ["quarteis", "postos"], group: "Cadastros", to: "/unidades" },
  { id: "hidrantes", label: "Pontos de água", keywords: ["hidrante", "cisterna", "agua"], group: "Cadastros", to: "/hidrantes" },
]

type Entry =
  | { kind: "command", command: NavCommand }
  | { kind: "occurrence", occurrence: Occurrence }

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  // Results remember the text they answer, so a stale answer never shows
  // under a newer query and nothing has to be cleared from an effect.
  const [found, setFound] = useState<{ query: string, items: Occurrence[] }>({ query: "", items: [] })
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setActive(0)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      } else if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault()
        navigate("/ocorrencias?nova=1")
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [navigate])

  // Anything of three characters or more is also looked up as an occurrence:
  // a protocol, a street, a word of the report.
  useEffect(() => {
    const text = query.trim()
    if (!open || (text.length < 3 && !looksLikeProtocol(text))) return
    const timer = window.setTimeout(() => {
      occurrences.list({ search: text, per_page: 6 })
        .then((page) => setFound({ query: text, items: page.items }))
        .catch(() => setFound({ query: text, items: [] }))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query, open])

  const entries: Entry[] = useMemo(() => {
    const commands = rankCommands(COMMANDS, query).slice(0, 8).map((command) => ({ kind: "command" as const, command }))
    const hits = (found.query === query.trim() ? found.items : [])
      .map((occurrence) => ({ kind: "occurrence" as const, occurrence }))
    // A protocol typed on purpose wants the occurrence, not a screen.
    return looksLikeProtocol(query) ? [...hits, ...commands] : [...commands, ...hits]
  }, [query, found])

  function run(entry: Entry | undefined) {
    if (!entry) return
    navigate(entry.kind === "command" ? entry.command.to : `/ocorrencias/${entry.occurrence.id}`)
    close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] bg-chrome/60 backdrop-blur-[2px]" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onMouseDown={(event) => event.stopPropagation()}
        className="mx-auto mt-[12vh] flex w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden rounded-sm border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 text-ink-soft" />
          <input
            ref={inputRef}
            // Focused on mount, not after a timeout: a dispatcher who types
            // straight after Ctrl+K must not lose the first letter.
            autoFocus
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); close() }
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, entries.length - 1)) }
              if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)) }
              if (event.key === "Enter") { event.preventDefault(); run(entries[active]) }
            }}
            placeholder="Ir para tela, protocolo, endereço..."
            aria-label="Buscar comando ou ocorrência"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            className="h-12 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-soft"
          />
          <kbd className="label-caps rounded-sm border border-line px-1.5 py-0.5 text-ink-soft">Esc</kbd>
        </div>

        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {entries.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">Nada encontrado.</li>}
          {entries.map((entry, index) => (
            <li
              key={entry.kind === "command" ? entry.command.id : entry.occurrence.id}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => run(entry)}
              className={cn("flex cursor-pointer items-center gap-3 px-4 py-2", index === active && "bg-accent-soft")}
            >
              {entry.kind === "command" ? (
                <>
                  {entry.command.id === "new" ? <Plus className="h-4 w-4 text-accent" /> : <CornerDownLeft className="h-4 w-4 text-ink-soft" />}
                  <span className="flex-1 text-sm text-ink">{entry.command.label}</span>
                  <span className="label-caps text-ink-soft">{entry.command.id === "new" ? "Alt+N" : entry.command.group}</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 text-alert" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-ink">{entry.occurrence.protocol} · {NATURE_LABEL[entry.occurrence.nature]}</span>
                    <span className="truncate text-xs text-ink-muted">{entry.occurrence.address}</span>
                  </span>
                  <span className="label-caps text-ink-soft">Ocorrência</span>
                </>
              )}
            </li>
          ))}
        </ul>

        <p className="border-t border-line bg-surface-muted px-4 py-2 text-xs text-ink-muted">
          ↑↓ para escolher · Enter para abrir · <strong>Ctrl+K</strong> abre e fecha · <strong>Alt+N</strong> nova ocorrência
        </p>
      </div>
    </div>
  )
}
