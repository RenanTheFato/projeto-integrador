import { Button } from "@/components/ui/button"
import { Flame, Info } from "lucide-react"

export default function CardSuperiorRotas(){
    return(
        <>
        
      <div className="flex justify-center items-center mt-10">
        <div className="flex justify-around items-center gap-150 p-4 border bg-[#DE5656] w-350 ">
            <div className="flex gap-4 items-center">
                <Flame className="h-20 w-20 bg-white rounded-full p-2 border" />
                <div className="flex flex-col">
                <p className="text-xl font-bold md:text-2xl text-white">
                    Incêndio severo                      
                </p>
                <p className="text-white"> 
                    Solicitado em: <span className="font-bold">03/10 - 23:39H</span>
                </p>
                </div>
            </div>
            <div className="flex items-center justify-center">
                <Button className="bg-white border border-black rounded-none shadow-xl p-6">
                    <Info className="h-10 w-10"/>
                    <p className="text-xl font-light">Detalhes da Ocorrência</p>
                    </Button>
            </div>
        </div>
      </div>
        </>
    )
}