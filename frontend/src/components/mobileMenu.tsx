import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

export function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
        >
          <Menu/>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="bg-white">
        <nav className="mt-8 flex flex-col gap-4 p-6">
          <a href="#">Ocorrências</a>
          <a href="#">Rede Neural</a>
          <a href="#">Rotas</a>
          <a href="#">Equipe</a>
          <a href="#">Atendimento</a>
          <a href="#">Serviços Adicionais</a>
        </nav>
      </SheetContent>
    </Sheet>
  )
}