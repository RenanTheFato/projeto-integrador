import { Flame } from "lucide-react"

export default function DetalhesOcorrencia(){
    return(
        <>
        <div className="flex flex-col items-center mt-10">
        <div className="flex px-12 py-4 border bg-[#DE5656] w-237.5">
            <div className="flex gap-4 items-center">
                <div className="flex justify-center items-center h-20 w-20 bg-white rounded-full p-2 border">
                <Flame className="h-12 w-12" />
                </div>
                <div className="flex flex-col">
                <p className="text-xl font-bold text-white">
                    Incêndio severo                      
                </p>
                
                <p className="text-white"> 
                    Solicitado: 03/10 - 23:39
                </p>
                </div>
            </div>
        </div>

        <div className="flex px-12 py-4 border bg-white w-237.5 ">
            <div className="flex gap-4 items-center">
                <div className="flex flex-col">
                    <div className="py-4">
                        <p className="text-xl font-bold text-black ">
                            Detalhes                 
                        </p>
                        <p className="text-black py-2 text-xl"> 
                            Nome do Solicitante: <span className="font-semibold">Luciano</span>
                        </p>
                        <p className="text-black text-xl"> 
                            Atendido por: <span className="font-semibold">Marcos Antônio</span>
                        </p>
                    </div>

                    <div className="py-4">
                        <p className="text-xl font-bold text-black ">
                            Localizações                 
                        </p>
                        <p className="text-black py-2 text-xl"> 
                            Local do Incidente: <span className="font-semibold">Rua Jacques Félix, Centro,  Nº 451</span>
                        </p>
                        <p className="text-black text-xl"> 
                            Posto Responsável: <span className="font-semibold">Bombeiros Av. Santa Luiza de Marillac, N° 1085 - Vila São José</span>
                        </p>
                    </div>

                    <div className="py-4">
                        <p className="text-xl font-bold text-black ">
                            Descrição do Incidente                 
                        </p>
                        <p className="text-black py-2 text-xl"> 
                            “Tem um incêndio muito forte aqui, o fogo tá alto e se espalhando rápido. A fumaça tá muito preta e o calor é muito forte, 
                            já tá pegando nas casas ao lado. Tem gente aqui perto tentando sair, mas tá difícil, acho que pode ter pessoas presas.
                            Por favor, venham urgente, é na rua Rua Jacques Félix, perto do número 451, tá fora de controle!”
                        </p>
                    </div>

                    <div className="py-4">
                        <p className="text-xl font-bold text-black ">
                        Técnico               
                        </p>
                        <p className="text-black py-1 text-xl"> 
                            Sistema Inteligênte utilizado? <span className="font-semibold">Sim</span>
                        </p>
                        <p className="text-black py-1 text-xl"> 
                            Tempo de Cálculo de rota: <span className="font-semibold">12.8s</span>
                        </p>
                        <p className="text-black py-1 text-xl"> 
                            Melhor rota: <span className="font-semibold">8:43m</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
        </div>
        </>
    )
}