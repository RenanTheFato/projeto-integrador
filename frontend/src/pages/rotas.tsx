import CardSuperiorRotas from "@/components/cardSrotas"
import Mapa from "@/components/mapa/mapa"
import CardinferiorRotas from "@/components/cardInfRotas"

export default function Rotas(){
    return(
        <>
        <div className="flex flex-col justify-center items-center">
        <CardSuperiorRotas/>
        <Mapa/>
        <CardinferiorRotas/>
        </div>
        </>
    )
}