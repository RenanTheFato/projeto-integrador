import { lazy, Suspense } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"

import "./App.css"

import Navbar from "@/components/layout/navbar"
import { FullPageSpinner } from "@/components/layout/feedback"
import { CommandPalette } from "@/components/layout/command-palette"
import { CriticalAlerts } from "@/components/layout/critical-alert"

import Painel from "@/pages/painel"

// The panel is the first screen and loads with the shell; every other screen
// is fetched on first visit, so opening the console does not wait for the
// map engine, the charts and the 3D vehicles all at once.
const Ocorrencias = lazy(() => import("@/pages/ocorrencias"))
const OcorrenciaDetalhe = lazy(() => import("@/pages/ocorrencia-detalhe"))
const Despachos = lazy(() => import("@/pages/despachos"))
const Rotas = lazy(() => import("@/pages/rotas"))
const Estatisticas = lazy(() => import("@/pages/estatisticas"))
const RedeNeural = lazy(() => import("@/pages/rede-neural"))
const Efetivo = lazy(() => import("@/pages/efetivo"))
const Viaturas = lazy(() => import("@/pages/viaturas"))
const Guarnicoes = lazy(() => import("@/pages/guarnicoes"))
const Turnos = lazy(() => import("@/pages/turnos"))
const Unidades = lazy(() => import("@/pages/unidades"))
const Cobertura = lazy(() => import("@/pages/cobertura"))
const Hidrantes = lazy(() => import("@/pages/hidrantes"))
const Terminal = lazy(() => import("@/pages/terminal"))
const Telao = lazy(() => import("@/pages/telao"))

/**
 * There is no login.
 *
 * The console runs on a screen inside the station and is read while someone is
 * on the phone reporting a fire; a sign-in form between the operator and the
 * incident form costs seconds that belong to the call. Every screen is
 * therefore open, and the bar is the only chrome around them.
 */
function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <CriticalAlerts />
      <CommandPalette />
      <main className="flex-1">
        <Suspense fallback={<FullPageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Painel />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
        <Route path="/ocorrencias/:id" element={<OcorrenciaDetalhe />} />
        <Route path="/despachos" element={<Despachos />} />
        <Route path="/rotas" element={<Rotas />} />
        <Route path="/cobertura" element={<Cobertura />} />
        <Route path="/estatisticas" element={<Estatisticas />} />
        <Route path="/rede-neural" element={<RedeNeural />} />

        <Route path="/efetivo" element={<Efetivo />} />
        <Route path="/viaturas" element={<Viaturas />} />
        <Route path="/guarnicoes" element={<Guarnicoes />} />
        <Route path="/turnos" element={<Turnos />} />
        <Route path="/unidades" element={<Unidades />} />
        <Route path="/hidrantes" element={<Hidrantes />} />
      </Route>

      {/* Screens for other devices: the tablet in the cab and the TV on the
          wall. They carry their own chrome, sized for gloves and distance. */}
      <Route path="/terminal" element={<Suspense fallback={<FullPageSpinner />}><Terminal /></Suspense>} />
      <Route path="/terminal/:vehicleId" element={<Suspense fallback={<FullPageSpinner />}><Terminal /></Suspense>} />
      <Route path="/telao" element={<Suspense fallback={<FullPageSpinner />}><Telao /></Suspense>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
