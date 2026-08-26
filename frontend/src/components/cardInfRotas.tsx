
import { Separator } from "./ui/separator"
export default function CardinferiorRotas(){
    return(
    <>
   <div className="mt-5 flex justify-center px-4">
  <div className="border bg-white px-4 py-4">

    <div className="mb-6 flex">
      <p className="text-xl font-bold md:text-2xl">
        Informações da Rota
      </p>
    </div>

    <div className="flex flex-wrap items-center justify-center gap-6">

      <div className="flex justify-center">
        <div className="flex flex-col">
          <p className="font-semibold">Quartel Atendente</p>
          <p>Latitude: -23,14151345163560</p>
          <p>Longitude: -45,0398465015018</p>
        </div>
      </div>

      <Separator className="hidden h-16 bg-black lg:block" orientation="vertical" />

      <div className="flex justify-center">
        <div className="flex flex-col">
          <p className="font-semibold">Local Solicitante</p>
          <p>Latitude: -23,502984754385</p>
          <p>Longitude: -45,0748507038083</p>
        </div>
      </div>

      <Separator className="hidden h-16 bg-black lg:block" orientation="vertical" />

      <div className="flex justify-center">
        <div className="flex flex-col">
          <p className="font-semibold">Métricas</p>
          <p>
            Distancia Percorrida:
            <span className="ml-1 font-bold">9.52km</span>
            <span className="ml-1 font-semibold text-red-600">
              +22.74%
            </span>
          </p>
          <p>
            Tempo Economizado:
            <span className="ml-1 font-bold">12.7km</span>
            <span className="ml-1 font-semibold text-green-600">
              -46.35%
            </span>
          </p>
        </div>
      </div>

      <Separator className="hidden h-16 bg-black lg:block" orientation="vertical" />

      <div className="flex justify-center">
        <div className="flex flex-col">
          <p className="font-semibold">Vias Percorridas</p>
          <p>
            <span className="ml-0.5">Rodovias: 1</span>
            <span className="ml-2">Secundárias: 3</span>
            <span className="ml-2">Residências: 2</span>
          </p>
          <p>
            <span className="ml-0.5">Primárias: 1</span>
            <span className="ml-2">Terciárias: 0</span>
            <span className="ml-2">Não identificadas: 0</span>
          </p>
        </div>
      </div>

      <Separator className="hidden h-16 bg-black lg:block" orientation="vertical" />

      <div className="flex justify-center">
        <div className="flex flex-col">
          <p className="font-semibold">Modelo</p>
          <p>Tempo de Resposta:</p>
          <p className="font-semibold">14.64s</p>
        </div>
      </div>
    </div>
  </div>
</div>
    </>        
    )
}