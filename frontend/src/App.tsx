import { Navigate, Route, Routes } from "react-router-dom"

import "./App.css"

import Navbar from "@/components/layout/navbar"
import { RequireAuth, RequireRole } from "@/auth/protected-route"

import Login from "@/pages/login"
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
import Usuarios from "@/pages/usuarios"

/** Everything inside the guard shares the bar; the login screen does not. */
function Shell() {
  return (
    <div className="min-h-screen bg-[#F5EFE6]">
      <Navbar />
      <RequireAuth />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Shell />}>
        <Route path="/" element={<Painel />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
        <Route path="/ocorrencias/:id" element={<OcorrenciaDetalhe />} />
        <Route path="/despachos" element={<Despachos />} />
        <Route path="/rotas" element={<Rotas />} />
        <Route path="/estatisticas" element={<Estatisticas />} />
        <Route path="/rede-neural" element={<RedeNeural />} />

        <Route path="/efetivo" element={<Efetivo />} />
        <Route path="/viaturas" element={<Viaturas />} />
        <Route path="/guarnicoes" element={<Guarnicoes />} />
        <Route path="/turnos" element={<Turnos />} />

        {/* Only these two roles may touch the hierarchy of units. */}
        <Route element={<RequireRole roles={["ADMIN", "COMANDANTE"]} />}>
          <Route path="/unidades" element={<Unidades />} />
        </Route>

        {/* Creating accounts is the administrator's alone. */}
        <Route element={<RequireRole roles={["ADMIN"]} />}>
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
