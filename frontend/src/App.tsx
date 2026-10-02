import { Navigate, Outlet, Route, Routes } from "react-router-dom"

import "./App.css"

import Navbar from "@/components/layout/navbar"

import Painel from "@/pages/painel"
import Ocorrencias from "@/pages/ocorrencias"
import OcorrenciaDetalhe from "@/pages/ocorrencia-detalhe"
import Despachos from "@/pages/despachos"
import Rotas from "@/pages/rotas"
import Estatisticas from "@/pages/estatisticas"
import RedeNeural from "@/pages/rede-neural"
import Efetivo from "@/pages/efetivo"
import Viaturas from "@/pages/viaturas"
import Guarnicoes from "@/pages/guarnicoes"
import Turnos from "@/pages/turnos"
import Unidades from "@/pages/unidades"
import Cobertura from "@/pages/cobertura"
import Hidrantes from "@/pages/hidrantes"

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
      <main className="flex-1">
        <Outlet />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
