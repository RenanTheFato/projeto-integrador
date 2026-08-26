import './App.css'
import Navbar from './components/navbar'
import { Route, Routes } from 'react-router-dom'
import Rotas from './pages/rotas'
import Home from './pages/home'
import RedeNeural from './pages/redeneural'
import Equipe from './pages/equipe'
import Atendimento from './pages/atendimento'
import ServicosAdicionais from './pages/servicos'
import Ocorrencias from './pages/ocorrencias'

function App() {
  return (
    <>
      <div className='bg-[#F5EFE6] '>
        <Navbar/>
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/Ocorrencias" element={<Ocorrencias/>}/>
          <Route path='/Rotas' element={<Rotas/>}/>
          <Route path='/Rede neural' element={<RedeNeural/>}/>
          <Route path='/Equipe' element={<Equipe/>}/>
          <Route path='/Atendimento' element={<Atendimento/>}/>
          <Route path='/Servicos adicionais' element={<ServicosAdicionais/>}/>
        </Routes>
        </div>
    </>
  )
}

export default App
