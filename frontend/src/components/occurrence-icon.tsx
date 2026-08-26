/**
 * The icon that identifies a nature of occurrence.
 *
 * The first version of the interface put a lucide icon inside a white circle
 * over the severity colour; that pairing is kept, only driven by the enum the
 * backend sends instead of being written by hand per card.
 */

import {
  Ambulance, Bird, ClipboardCheck, Factory, Flame, House, LifeBuoy,
  TreePine, TriangleAlert, Waves,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { OccurrenceNature } from "@/api/types"
import { cn } from "@/lib/utils"

const NATURE_ICON: Record<OccurrenceNature, LucideIcon> = {
  INCENDIO_EDIFICACAO: House,
  INCENDIO_VEGETACAO: TreePine,
  INCENDIO_VEICULO: Flame,
  SALVAMENTO: LifeBuoy,
  ATENDIMENTO_PRE_HOSPITALAR: Ambulance,
  PRODUTOS_PERIGOSOS: Factory,
  AFOGAMENTO: Waves,
  CAPTURA_ANIMAL: Bird,
  VISTORIA: ClipboardCheck,
  OUTROS: TriangleAlert,
}

export function OccurrenceIcon({ nature, className }: { nature: OccurrenceNature, className?: string }) {
  const Icon = NATURE_ICON[nature] ?? TriangleAlert
  return <Icon className={cn("h-6 w-6", className)} />
}

/** The icon in its white circle, as the original cards showed it. */
export function OccurrenceAvatar({ nature, size = "md" }: {
  nature: OccurrenceNature
  size?: "sm" | "md" | "lg"
}) {
  const box = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-11 w-11" : "h-14 w-14"
  const icon = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-6 w-6" : "h-8 w-8"

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full border bg-white", box)}>
      <OccurrenceIcon nature={nature} className={icon} />
    </div>
  )
}
