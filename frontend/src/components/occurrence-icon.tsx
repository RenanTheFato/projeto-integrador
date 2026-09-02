/**
 * The icon that identifies a nature of occurrence.
 *
 * The icon sits in a neutral disc and takes the severity colour on its stroke,
 * rather than being punched white out of a coloured tile. A list of fifteen
 * calls then carries fifteen small marks instead of fifteen coloured slabs, and
 * severity still reads from across the room because the disc is paired with the
 * rail down the side of the row.
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

export function OccurrenceAvatar({ nature, size = "md", tone = "text-ink-muted" }: {
  nature: OccurrenceNature
  size?: "sm" | "md" | "lg"
  /** A `PRIORITY_TEXT_TONE` class, so the mark carries the severity too. */
  tone?: string
}) {
  const box = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12"
  const icon = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6"

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-muted", box)}>
      <OccurrenceIcon nature={nature} className={cn(icon, tone)} />
    </div>
  )
}
