/**
 * The application bar.
 *
 * It is the console's chrome: a graphite strip that frames the workspace the
 * way the bezel of an instrument frames its dial. The gradient of the first
 * version is gone — a bar is not the place to spend colour — and what is left
 * on the right is the only status the bar itself owns: whether the live feed
 * is connected, and the time the shift is being run against.
 *
 * There is no session, so there is no account block and no way out of the
 * system; every screen is one click away, always.
 */

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu, Radio, Search } from "lucide-react"
import { Link, NavLink } from "react-router-dom"

import zeno from "@/assets/Zeno.png"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { openCommandPalette } from "@/lib/palette-events"
import { AlertToggle } from "@/components/layout/critical-alert"
import { useRealtime } from "@/hooks/use-realtime"
import { cn } from "@/lib/utils"

interface NavItem {
  to: string
  label: string
}

const OPERATIONAL: NavItem[] = [
  { to: "/", label: "Painel" },
  { to: "/ocorrencias", label: "Ocorrências" },
  { to: "/despachos", label: "Despachos" },
  { to: "/rotas", label: "Rotas" },
  { to: "/cobertura", label: "Cobertura" },
  { to: "/estatisticas", label: "Estatísticas" },
  { to: "/rede-neural", label: "IA" },
]

const REGISTRY: NavItem[] = [
  { to: "/efetivo", label: "Efetivo" },
  { to: "/viaturas", label: "Viaturas" },
  { to: "/guarnicoes", label: "Guarnições" },
  { to: "/turnos", label: "Turnos" },
  { to: "/unidades", label: "Unidades" },
  { to: "/hidrantes", label: "Pontos de água" },
]

/** An underline in the accent marks the screen you are on — no colour fill. */
const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-full items-center border-b-2 border-transparent px-0.5 text-sm font-medium transition-colors",
    isActive ? "border-accent text-white" : "text-chrome-muted hover:text-white",
  )

export default function Navbar() {
  const { connected } = useRealtime(() => undefined)

  const [registryOpen, setRegistryOpen] = useState(false)
  const registryRef = useRef<HTMLDivElement>(null)

  // A dropdown that stays open after the pointer leaves is a nuisance on a
  // wall-mounted screen, so any click outside closes it.
  useEffect(() => {
    if (!registryOpen) return

    const onClickOutside = (event: MouseEvent) => {
      if (registryRef.current && !registryRef.current.contains(event.target as Node)) {
        setRegistryOpen(false)
      }
    }

    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [registryOpen])

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-chrome-line bg-chrome px-3 sm:h-16 sm:gap-6 sm:px-4 lg:px-6">
      <Link to="/" className="flex shrink-0 items-center gap-3">
        {/* The mark is a glow on black. Screening it over the bar drops the
            black and leaves the glow, so no cut-out asset is needed. */}
        <img src={zeno} alt="Zeno" className="h-10 w-auto object-contain mix-blend-screen sm:h-12" />
        <span className="hidden border-l border-chrome-line pl-3 leading-tight sm:block">
          <span className="block text-xs font-semibold text-chrome-ink">Central de Despacho</span>
          <span className="label-caps block text-chrome-muted">CB · Taubaté</span>
        </span>
      </Link>

      <nav className="hidden h-full items-stretch gap-5 xl:flex 2xl:gap-7">
        {OPERATIONAL.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
            {item.label}
          </NavLink>
        ))}

        <div className="relative flex items-stretch" ref={registryRef}>
          <button
            type="button"
            onClick={() => setRegistryOpen((open) => !open)}
            className={cn(
              "flex h-full items-center gap-1 border-b-2 border-transparent px-0.5 text-sm font-medium transition-colors",
              registryOpen ? "text-white" : "text-chrome-muted hover:text-white",
            )}
          >
            Cadastros
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", registryOpen && "rotate-180")} />
          </button>

          {registryOpen && (
            <div className="absolute right-0 top-full z-40 flex w-52 flex-col rounded-sm border border-line bg-surface py-1 shadow-2xl">
              {REGISTRY.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setRegistryOpen(false)}
                  className={({ isActive }) => cn(
                    "px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink",
                    isActive && "bg-accent-soft font-semibold text-accent",
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-2 rounded-sm border border-chrome-line px-2 py-1.5 text-chrome-muted transition-colors hover:text-white"
          aria-label="Buscar tela ou ocorrência (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
          <kbd className="label-caps hidden 2xl:inline">Ctrl K</kbd>
        </button>
        <AlertToggle />
        <LiveIndicator connected={connected} />
        <Clock />
        <MobileNav />
      </div>
    </header>
  )
}

/**
 * Whether the socket is up.
 *
 * A dispatcher trusts these screens to be current, so the one thing the bar
 * must never hide is that they have stopped being current. Connected is stated
 * quietly in the accent; offline turns red, because then the numbers are old.
 */
function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? "Recebendo eventos em tempo real" : "Sem conexão em tempo real"}
      className={cn(
        "label-caps hidden items-center gap-1.5 rounded-sm border px-2 py-1 sm:inline-flex",
        connected
          ? "border-accent/40 bg-accent/15 text-white"
          : "border-alert/50 bg-alert/20 text-white",
      )}
    >
      <Radio className={cn("h-3.5 w-3.5", connected && "animate-pulse")} />
      {connected ? "Ao vivo" : "Offline"}
    </span>
  )
}

/** The shift is run against the clock, so the console carries one. */
function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <time
      dateTime={now.toISOString()}
      className="hidden text-sm font-semibold tabular-nums text-chrome-ink lg:block"
    >
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </time>
  )
}

function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="rounded-sm border border-chrome-line p-2 text-chrome-ink transition-colors hover:bg-chrome-soft xl:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>

      {/* The kit's own close button inherits shadcn tokens this project never
          defined, so it would be invisible on the dark panel. */}
      <SheetContent side="right" showCloseButton={false} className="border-chrome-line bg-chrome">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="absolute right-3 top-3 rounded-sm px-2 py-1 text-2xl leading-none text-chrome-muted transition-colors hover:text-white"
        >
          ×
        </button>

        <nav className="mt-10 flex flex-col p-3">
          <p className="label-caps px-3 py-2 text-chrome-muted">Operação</p>
          {OPERATIONAL.map((item) => (
            <MobileLink key={item.to} item={item} onNavigate={() => setOpen(false)} />
          ))}

          <p className="label-caps mt-4 px-3 py-2 text-chrome-muted">Cadastros</p>
          {REGISTRY.map((item) => (
            <MobileLink key={item.to} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function MobileLink({ item, onNavigate }: { item: NavItem, onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) => cn(
        "border-l-2 px-3 py-2.5 font-medium transition-colors",
        isActive
          ? "border-accent bg-chrome-soft text-white"
          : "border-transparent text-chrome-muted hover:text-white",
      )}
    >
      {item.label}
    </NavLink>
  )
}
