/**
 * The shared building blocks every screen is made of.
 *
 * They carry over the visual language of the first version of the interface:
 * square white panels with a plain border over the cream page, a coloured
 * header strip for anything that has a severity, and oversized numbers for the
 * figures a dispatcher reads at a glance.
 */

import { Children, createContext, useContext, useEffect, useState } from "react"
import type { ChangeEvent, ReactNode } from "react"

import { cn } from "@/lib/utils"

import "./table.css"

// -- Page scaffolding --------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-neutral-300 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-neutral-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6">{children}</div>
}

export function Panel({ title, icon, actions, children, className }: {
  title?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col border bg-white", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {icon}
            {title && <h2 className="text-lg font-semibold text-neutral-900 sm:text-xl">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">{children}</div>
    </section>
  )
}

// -- Indicators --------------------------------------------------------------

export function Badge({ tone, children }: { tone: string, children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center px-3 py-1 text-sm font-semibold text-white", tone)}>
      {children}
    </span>
  )
}

/** The oversized figure the dashboard is built from. */
export function StatBox({ icon, label, value, hint, tone = "text-neutral-900" }: {
  icon?: ReactNode
  label: string
  value: ReactNode
  hint?: string
  tone?: string
}) {
  return (
    <div className="flex flex-col gap-2 border bg-white px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2 text-neutral-700">
        {icon}
        <p className="text-lg">{label}</p>
      </div>
      <p className={cn("text-3xl font-bold sm:text-4xl", tone)}>{value}</p>
      {hint && <p className="text-sm text-neutral-500">{hint}</p>}
    </div>
  )
}

// -- Buttons -----------------------------------------------------------------

type ButtonTone = "primary" | "neutral" | "danger" | "ghost"

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: "border-transparent bg-[#DE5656] text-white hover:bg-[#c94747]",
  neutral: "border-neutral-800 bg-white text-neutral-900 hover:bg-neutral-100",
  danger: "border-transparent bg-red-800 text-white hover:bg-red-900",
  ghost: "border-transparent bg-transparent text-neutral-700 hover:bg-neutral-200",
}

export function ActionButton({ tone = "neutral", className, children, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 border px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_TONES[tone],
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Destructive action guarded by a second click.
 *
 * A native `confirm()` would block the page — and the backend answers 409 when
 * a record still has links, so the mistake this guards against is common
 * enough to be worth the extra tap.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, className }: {
  label: ReactNode
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(timer)
  }, [armed])

  return (
    <ActionButton
      tone={armed ? "danger" : "ghost"}
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => {
        if (!armed) { setArmed(true); return }
        setArmed(false)
        onConfirm()
      }}
    >
      {armed ? confirmLabel : label}
    </ActionButton>
  )
}

// -- Form controls -----------------------------------------------------------

export function Field({ label, hint, required, children }: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-neutral-800">
        {label}
        {required && <span className="text-[#DE5656]"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

/**
 * Puts a button on the same line as the inputs beside it.
 *
 * A `Field` stacks a label over its control, and optionally a hint under it, so
 * a bare button in the same row lands a label's height too high with
 * `items-start` and hangs below the hint with `items-end`. Reserving the same
 * invisible label gives the button the offset every other column already has,
 * and the row can then align to the top and stay put however tall the hints
 * around it get.
 */
export function FieldButton({ children, className }: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span aria-hidden className="select-none text-sm font-semibold text-transparent">.</span>
      {children}
    </div>
  )
}

const CONTROL = "border border-neutral-400 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-[#DE5656]"

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-24 resize-y", props.className)} />
}

export function Select({ options, placeholder, value, onChange, ...props }: {
  options: { value: string, label: string }[]
  placeholder?: string
  value: string
  onChange: (value: string) => void
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  return (
    <select
      {...props}
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      className={cn(CONTROL, props.className)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

// -- Tables ------------------------------------------------------------------

/**
 * The column names, so a cell can carry its own on a narrow screen.
 *
 * Below `sm` the table stacks into cards (see `table.css`) and each cell needs
 * to say which column it is. Passing that down through context rather than
 * asking every screen to repeat its headers on every cell keeps the eight
 * tables in this system declaring their headers exactly once.
 */
const TableHeaders = createContext<string[]>([])
const ColumnIndex = createContext(0)

export function Table({ headers, children }: { headers: string[], children: ReactNode }) {
  return (
    <TableHeaders.Provider value={headers}>
      <div className="w-full sm:overflow-x-auto">
        <table className="stack-table w-full border-collapse text-left sm:min-w-[640px]">
          <thead>
            <tr className="border-b-2 border-neutral-300">
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-sm font-bold uppercase tracking-wide text-neutral-600">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </TableHeaders.Provider>
  )
}

export function Row({ children, onClick }: { children: ReactNode, onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-neutral-200 align-middle",
        onClick && "cursor-pointer hover:bg-[#F5EFE6]",
      )}
    >
      {Children.map(children, (child, index) => (
        <ColumnIndex.Provider value={index}>{child}</ColumnIndex.Provider>
      ))}
    </tr>
  )
}

export function Cell({ children, className, title }: {
  children: ReactNode
  className?: string
  /** Native tooltip, for a column that shows an acronym and means a name. */
  title?: string
}) {
  const headers = useContext(TableHeaders)
  const label = headers[useContext(ColumnIndex)]

  // An actions column has a header nobody needs read back to them.
  const stackLabel = label && label !== "Ações" ? label : undefined

  return (
    <td
      title={title}
      data-label={stackLabel}
      className={cn("px-3 py-2.5 text-neutral-800", className)}
    >
      {children}
    </td>
  )
}

export function Pagination({ page, perPage, total, onPage }: {
  page: number
  perPage: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  if (total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-sm text-neutral-600">
        {total} registro{total === 1 ? "" : "s"} — página {page} de {pages}
      </p>

      <div className="flex gap-2">
        <ActionButton
          tone="neutral"
          className="px-3 py-1"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </ActionButton>
        <ActionButton
          tone="neutral"
          className="px-3 py-1"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </ActionButton>
      </div>
    </div>
  )
}

// -- Modal -------------------------------------------------------------------

/**
 * A dialog that fits on the screen it is opened on.
 *
 * The first version centred the card with `items-center` inside the scrolling
 * backdrop. That is the classic flexbox trap: a dialog taller than the viewport
 * has its top half pushed above the scroll origin, where nothing can scroll to
 * it — which is exactly what happened to the incident form, whose top fields
 * were unreachable on a laptop without zooming the browser out.
 *
 * Two things fix it. `min-h-full` on the row makes the centring safe, because
 * the row is never shorter than the scroll area. And the card is capped at the
 * viewport height with only its body scrolling, so the title and the close
 * button stay put however long the form gets.
 */
export function Modal({ title, onClose, children, wide }: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  // Escape closes, and the page behind stops scrolling while it is open —
  // otherwise a wheel at the edge of the dialog scrolls the list underneath.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "flex max-h-[calc(100dvh-1.5rem)] w-full flex-col border bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]",
            wide ? "max-w-4xl" : "max-w-2xl",
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-linear-to-r from-red-300 to-orange-300 px-4 py-3 sm:px-5">
            <h2 className="min-w-0 truncate text-lg font-bold text-neutral-900 sm:text-xl">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 px-2 text-2xl leading-none text-neutral-800 hover:text-black"
              aria-label="Fechar"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
