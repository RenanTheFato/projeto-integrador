import { Settings, SquareMousePointer } from "lucide-react"

export default function CardGraficos(){
    return(
        <>
        <div className="flex flex-col gap-30">
        <div className="mt-3 flex flex-col gap-4 px-4 lg:flex-wrap">
      
      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full max-w-md">
        <div className="flex items-center gap-2">

            <p className="text-xl font-bold">
               Parâmetros Aplicados
            </p>
        </div>

        <div className="flex justify-around items-center gap-12 md:gap-20 text-2xl py-0.5">
          <div className="flex flex-col">
            <p className="text-blue-900 text-3xl font-bold">85% Treinamento</p>
            <p className="text-lg text-orange-500 md:text-xl font-semibold">15% Validação</p>
          </div>
          <div className="">
                <Settings className="h-14 w-14"/>
            </div>
        </div>
      </div>

      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full max-w-md">
        <div className="flex items-center gap-2">

            <p className="text-xl font-bold">
               Dados Processados
            </p>
        </div>

        <div className="flex flex-col justify-around text-2xl gap-2">
          <div className="flex justify-around">
            <div className="flex flex-col items-center">
            <p className=" text-xl"><span className="font-bold text-4xl">4256</span>Ruas</p>
            <p className="text-sm font-light">Taubaté-SP</p>
            </div>
            <div className="flex flex-col items-center">
            <p className="text-xl"><span className="font-bold text-4xl">1439</span>Nós</p>
            <div className="flex gap-1">
            <SquareMousePointer className="h-5 w-5 text-blue-900"/>
            <p className="text-sm font-light text-blue-900">Ver Tudo</p>
            </div>
            </div>
          </div>
            <div className="flex justify-around">   
            
            <div className="flex gap-1">
            
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="mt-3 flex flex-col gap-4 px-4 lg:flex-wrap">

      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full max-w-md">
        <div className="flex items-center gap-2">

            <p className="text-xl font-bold">
               Tempo de Execução
            </p>
        </div>

        <div className="flex flex-col justify-around text-2xl gap-2 py-3.5">
          <div className="flex justify-around items-center">
            <p className=" text-4xl font-bold ">12.8s</p>
            <p className="text-4xl font-bold">{">"}</p>
            <p className="text-4xl font-bold">8.43s</p>
            <p className="text-green-600 font-bold">-34.2%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col border bg-white px-6 py-2 gap-6 w-full max-w-md">
        <div className="flex items-center gap-2">

            <p className="text-xl font-bold">
              Operacional
            </p>
        </div>

        <div className="flex flex-col justify-around text-2xl gap-2">
          <div className="flex justify-around">
            <div className="flex flex-col items-center">
            <p className=" text-4xl font-bold">12/12</p>
            <p className="text-lg">Cores</p>
            </div>
            <div className="flex flex-col items-center">
            <p className="text-4xl font-bold">36/36</p>
            <p className="text-lg">Threads</p>
            </div>
            <p className="text-green-600 font-bold">100%</p>
          </div>
        </div>
      </div>
      </div>
      </div>
        </>
    )
}