import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import CardsLaterais from "./cardsLateral"

export function MobileInfo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="gap-2 ml-25 mt-10"
        >
          <Menu/>
          <p className="">Informações Adicionais</p>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="bg-white">
        <nav className="mt-8 flex flex-col gap-4 p-6">
            <CardsLaterais/>   
        </nav>
      </SheetContent>
    </Sheet>
  )
}