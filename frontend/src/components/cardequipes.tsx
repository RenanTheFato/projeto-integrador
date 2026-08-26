import { User } from "lucide-react"

export default function CardEquipes(){
    return(
        <>
        <div className="mt-3 flex flex-col items-center gap-4 px-4 lg:flex-row lg:flex-wrap lg:justify-center">
      
      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full ">
        <div className="flex items-center gap-2">
            <p className="text-xl font-bold">
                Equipe de Atendimento
            </p>
        </div>

        <div className="flex justify-around text-2xl">
          <div className="flex flex-col items-center">
            <div className="bg-orange-500 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>  
            </div>
            <p className="text-2xl font-bold">Paulo</p>
            <p className="text-lg">Piloto</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-orange-500 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Carlos</p>
            <p className="text-lg">Chefe de Operações</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-orange-500 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Rafael</p>
            <p className="text-lg">Bombeiro Militar</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-orange-500 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Felipe</p>
            <p className="text-lg">Técnico em Salvamento</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-orange-500 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Diego</p>
            <p className="text-lg">Auxiliar de Emergência</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-orange-500 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">André</p>
            <p className="text-lg">Resgatista</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full">
        <div className="flex items-center gap-2">
            <p className="text-xl font-bold">
                Equipe Policial
            </p>
        </div>

        <div className="flex justify-around text-2xl">
          <div className="flex flex-col items-center">
            <div className="bg-black rounded-full p-6">
                <User className="h-18 w-18 text-white  "/>
            </div>
            <p className="text-2xl font-bold">Marcos</p>
            <p className="text-lg">Delegado</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-black rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Pereira</p>
            <p className="text-lg">Investigador</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-black rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Fernando</p>
            <p className="text-lg">Escrivão</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-black rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Tiago</p>
            <p className="text-lg">Polícia Militar</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-black rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Eduardo</p>
            <p className="text-lg">Perito Criminal</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-black rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Santana</p>
            <p className="text-lg">Policial Federal</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full">
        <div className="flex items-center gap-2">
            <p className="text-xl font-bold">
                Equipe Médica
            </p>
        </div>

        <div className="flex justify-around text-2xl">
          <div className="flex flex-col items-center">
            <div className="bg-emerald-400 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Ana Oliveira</p>
            <p className="text-lg">Médica Emergencista</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-emerald-400 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Fernanda</p>
            <p className="text-lg">Enfermeira</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-emerald-400 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Ricardo</p>
            <p className="text-lg">Paramédico</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-emerald-400 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Juliana</p>
            <p className="text-lg">Técnica de Enfermagem</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-emerald-400 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">William</p>
            <p className="text-lg">Médico Geral</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-emerald-400 rounded-full p-6">
                <User className="h-18 w-18 text-white "/>
            </div>
            <p className="text-2xl font-bold">Santos</p>
            <p className="text-lg">Piloto</p>
          </div>
        </div>
      </div>
      </div>
        </>
    )
}