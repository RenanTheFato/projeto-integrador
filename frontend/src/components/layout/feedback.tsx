/** Loading, error and empty states, so every screen fails the same way. */

import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react"
import type { ReactNode } from "react"

export function FullPageSpinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3">
      <Loader2 className="h-10 w-10 animate-spin text-[#DE5656]" />
      <p className="text-lg text-neutral-700">{label}</p>
    </div>
  )
}

export function LoadingBlock({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 border bg-white px-6 py-10">
      <Loader2 className="h-6 w-6 animate-spin text-[#DE5656]" />
      <p className="text-neutral-700">{label}</p>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string, onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 border border-[#DE5656] bg-[#DE5656]/10 px-6 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#DE5656]" />
        <p className="text-neutral-900">{message}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex w-fit items-center gap-2 border border-neutral-800 bg-white px-4 py-1.5 text-sm font-semibold hover:bg-neutral-100"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar de novo
        </button>
      )}
    </div>
  )
}

/** Field-level messages from the backend's zod validation. */
export function ErrorDetails({ details }: { details: string[] | null }) {
  if (!details || details.length === 0) return null

  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-[#DE5656]">
      {details.map((detail) => <li key={detail}>{detail}</li>)}
    </ul>
  )
}

export function EmptyState({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 border bg-white px-6 py-14 text-center">
      <Inbox className="h-12 w-12 text-neutral-400" />
      <p className="text-xl font-semibold text-neutral-800">{title}</p>
      {description && <p className="max-w-md text-neutral-600">{description}</p>}
      {action}
    </div>
  )
}
