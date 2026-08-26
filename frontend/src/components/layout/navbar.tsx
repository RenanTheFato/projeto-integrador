/**
 * The application bar.
 *
 * Keeps the gradient and the Zeno mark of the first version, but the links now
 * follow the backend's modules. The registry screens sit behind a dropdown so
 * the operational ones — the incidents, the dispatches, the routes — stay one
 * click away during a shift.
 */

import { useEffect, useRef, useState } from "react"
import { ChevronDown, LogOut, Menu, Radio } from "lucide-react"
import { Link, NavLink, useNavigate } from "react-router-dom"

import zeno from "@/assets/Zeno.png"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { USER_ROLE_LABEL } from "@/api/labels"
import type { UserRole } from "@/api/types"
import { useAuth } from "@/auth/auth-context"
import { useRealtime } from "@/hooks/use-realtime"
import { cn } from "@/lib/utils"

interface NavItem {
  to: string
  label: string
  roles?: UserRole[]
}

const OPERATIONAL: NavItem[] = [
  { to: "/", label: "Painel" },
  { to: "/ocorrencias", label: "Ocorrências" },
  { to: "/despachos", label: "Despachos" },
  { to: "/rotas", label: "Rotas" },
  { to: "/rede-neural", label: "Rede Neural" },
]

const REGISTRY: NavItem[] = [
  { to: "/efetivo", label: "Efetivo" },
  { to: "/viaturas", label: "Viaturas" },
  { to: "/guarnicoes", label: "Guarnições" },
  { to: "/turnos", label: "Turnos" },
  { to: "/unidades", label: "Unidades" },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-lg font-semibold text-neutral-900 transition hover:scale-105",
    isActive && "underline decoration-[#DE5656] decoration-4 underline-offset-8",
  )

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <header className="flex h-20 w-full items-center justify-between gap-4 border-b bg-linear-to-r from-red-300 to-orange-300 px-4 lg:px-8">
      <Link to="/" className="flex shrink-0 items-center">
        <img src={zeno} alt="Zeno" className="h-24 w-24 object-contain" />
      </Link>

      <nav className="hidden items-center gap-6 xl:flex">
        {OPERATIONAL.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
            {item.label}
          </NavLink>
        ))}

        <div className="relative" ref={registryRef}>
          <button
            type="button"
            onClick={() => setRegistryOpen((open) => !open)}
            className="flex items-center gap-1 text-lg font-semibold text-neutral-900 transition hover:scale-105"
          >
            Cadastros
            <ChevronDown className={cn("h-4 w-4 transition", registryOpen && "rotate-180")} />
          </button>

          {registryOpen && (
            <div className="absolute right-0 top-9 z-40 flex w-52 flex-col border bg-white shadow-xl">
              {REGISTRY.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setRegistryOpen(false)}
                  className={({ isActive }) => cn(
                    "px-4 py-2.5 font-medium text-neutral-800 hover:bg-[#F5EFE6]",
                    isActive && "bg-[#F5EFE6] font-bold",
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="flex items-center gap-3">
        <span
          title={connected ? "Recebendo eventos em tempo real" : "Sem conexão em tempo real"}
          className={cn(
            "hidden items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold sm:flex",
            connected ? "border-green-700 bg-white text-green-700" : "border-neutral-500 bg-white text-neutral-500",
          )}
        >
          <Radio className={cn("h-4 w-4", connected && "animate-pulse")} />
          {connected ? "Ao vivo" : "Offline"}
        </span>

        {user && (
          <div className="hidden flex-col items-end leading-tight lg:flex">
            <span className="font-semibold text-neutral-900">{user.email}</span>
            <span className="text-sm text-neutral-700">{USER_ROLE_LABEL[user.role]}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          className="hidden items-center gap-2 border border-neutral-800 bg-white px-3 py-1.5 font-semibold hover:bg-neutral-100 sm:flex"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>

        <MobileNav onLogout={handleLogout} />
      </div>
    </header>
  )
}

function MobileNav({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="border border-neutral-800 bg-white p-2 xl:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="bg-white">
        <nav className="mt-10 flex flex-col gap-1 p-4">
          {[...OPERATIONAL, ...REGISTRY].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                "px-3 py-2.5 text-lg font-semibold text-neutral-800 hover:bg-[#F5EFE6]",
                isActive && "bg-[#F5EFE6] text-[#DE5656]",
              )}
            >
              {item.label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => { setOpen(false); onLogout() }}
            className="mt-4 flex items-center gap-2 border border-neutral-800 px-3 py-2.5 text-lg font-semibold"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
