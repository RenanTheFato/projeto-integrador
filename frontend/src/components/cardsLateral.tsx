import { Clock, Car, Users } from "lucide-react"

export default function CardsLaterais(){
    return(
        <>
        <div className="mt-3 flex flex-col gap-4 xl:px-4 xl:ml-6 max-w-sm">
      
            <div className="flex flex-col items-center justify-center gap-2 border bg-white px-4 py-4 w-full h-[182px]">
                <div className="flex items-center justify-center gap-2">
                    <div className="flex justify-center items-center">
                    <Clock className="h-10 w-10"/>
                    </div>
                    <p className="text-xl md:text-2xl">
                    Tempo Médio de deslocamento
                    </p>
                </div>

                <div className="flex flex-col items-center ">
                    <p className="text-black text-4xl font-bold">12:52</p>
                    <p className="text-lg text-black md:text-2xl">Minutos</p>
                </div>
            </div>


            <div className="flex flex-col items-center gap-2 justify-center border bg-white px-4 py-4 h-[182px] w-full">
                <div className="flex items-center justify-center gap-2">
                    <div className="flex justify-center items-center">
                    <Car className="h-10 w-10"/>
                    </div>
                    <p className="text-xl md:text-2xl">
                    Veículos disponíveis
                    </p>
                </div>
                <div className="flex flex-col items-center">
                    <p className="text-black text-5xl font-bold">26</p>
                </div>
            </div>

            <div className="flex flex-col items-center gap-2 justify-center border bg-white px-4 py-4 w-full h-[182px]">
                <div className="flex items-center gap-2 justify-center">
                    <div className="flex justify-center items-center ">
                    <Users className="h-10 w-10"/>
                    </div>
                    <p className="text-xl md:text-2xl">
                    Agentes disponíveis
                    </p>
                </div>
                <div className="flex flex-col items-center">
                    <p className="text-black text-5xl font-bold">72</p>
                </div>
            </div>
        </div>
        </>
    )
}