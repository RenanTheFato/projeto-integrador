import CardOcorrencias from "@/components/cardsOcorrencias"
import DetalhesOcorrencia from "@/components/detalhesOcorr"

export default function Ocorrencias(){
    return(
        <>
        <div className="flex justify-around">
        <CardOcorrencias/>
        <DetalhesOcorrencia/>
        </div>
        </>
    )
}