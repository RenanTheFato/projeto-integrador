import { Flame, Radiation, TreePine, Factory, House, WavesHorizontal } from "lucide-react"
import { Button } from "./ui/button"

export default function CardOcorrencias(){
    return(
        <>
    <div className="flex flex-col items-center mt-10">
        <div className="flex px-12 py-4 border bg-[#DE5656] w-125">
            <div className="flex gap-4 items-center">
                <div className="flex justify-center items-center h-20 w-20 bg-white rounded-full p-2 border">
                <Flame className="h-12 w-12" />
                </div>
                <div className="flex flex-col">
                <p className="text-xl font-bold text-white">
                    Incêndio severo                      
                </p>
                
                <p className="text-white"> 
                    03/10 - 23:39
                </p>
                </div>
            </div>
        </div>

        <div className="flex px-12 py-4 border bg-[#E8A240] w-125 ">
            <div className="flex gap-4 items-center">
                <div className="flex justify-center items-center h-20 w-20 bg-white rounded-full p-2 border">
                <Radiation className="h-12 w-12" />
                </div>
                <div className="flex flex-col">
                <p className="text-xl font-bold text-white">
                    Vazamento de Gás                   
                </p>
                
                <p className="text-white"> 
                    03/10 - 23:39
                </p>
                </div>
            </div>
        </div>

        <div className="flex px-12 py-4 border bg-green-500 w-125 ">
            <div className="flex gap-4 items-center">
                <div className="flex justify-center items-center h-20 w-20 bg-white rounded-full p-2 border">
                <TreePine className="h-12 w-12" />
                </div>
                <div className="flex flex-col">
                <p className="text-xl font-bold text-white">
                    Queda de Árvore sem vitimas                   
                </p>
                
                <p className="text-white"> 
                    03/10 - 23:39
                </p>
                </div>
            </div>
        </div>

        <div className="flex px-12 py-4 border bg-[#DE5656] w-125">
            <div className="flex gap-4 items-center">
                <div className="flex justify-center items-center h-20 w-20 bg-white rounded-full p-2 border">
                <Factory className="h-12 w-12" />
                </div>
                <div className="flex flex-col">
                <p className="text-xl font-bold text-white">
                    Explosão Industrial                      
                </p>
                
                <p className="text-white"> 
                    03/10 - 23:39
                </p>
                </div>
            </div>
        </div>

        <div className="flex px-12 py-4 border bg-[#DE5656] w-125">
            <div className="flex gap-4 items-center">
                <div className="flex justify-center items-center h-20 w-20 bg-white rounded-full p-2 border">
                <House className=" h-12 w-12" />
                </div>
                <div className="flex flex-col">
                <p className="text-xl font-bold text-white">
                    Incêndio severo                      
                </p>
                
                <p className="text-white"> 
                    03/10 - 23:39
                </p>
                </div>
            </div>
        </div>

        <div className="flex px-12 py-4 border bg-[#E8A240] w-125 ">
                    <div className="flex gap-4 items-center">
                        <div className=" flex items-center justify-center bg-white rounded-full p-2 border h-20 w-20">
                        <WavesHorizontal className="h-12 w-12" />
                        </div>
                        <div className="flex flex-col">
                        <p className="text-xl font-bold text-white">
                            Alagamento                   
                        </p>
                        
                        <p className="text-white"> 
                            03/10 - 23:39
                        </p>
                        </div>
                    </div>
                </div>

                <div className="flex px-12 py-4 border bg-white w-125 justify-center items-center">
                    <Button className="border-black rounded-none shadow-xl hover:scale-105 duration-100"><p className="text-xl p-10">Carregar Mais</p></Button>                   
                </div>
      </div>
        </>
    )
}