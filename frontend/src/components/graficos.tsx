import grafico from "@/assets/grafico.png"

export default function Graficos(){
    return(
        <>
        <div className="flex flex-col gap-25">
        <div className="bg-white h-fit border mt-3">
            <img src={grafico}></img>
        </div>
        <div className="bg-white h-fit border mt-3">
            <img src={grafico}></img>
        </div>
        </div>
        </>
    )
}