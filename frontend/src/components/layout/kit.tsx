/**
 * The shared building blocks every screen is made of.
 *
 * They carry over the visual language of the first version of the interface:
 * square white panels with a plain border over the cream page, a coloured
 * header strip for anything that has a severity, and oversized numbers for the
 * figures a dispatcher reads at a glance.
 */

import type { ChangeEvent, ReactNode } from "react"

import { cn } from "@/lib/utils"

// -- Page scaffolding --------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-neutral-300 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-1 text-neutral-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6">{children}</div>
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
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
          <div className="flex items-center gap-2">
            {icon}
            {title && <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5">{children}</div>
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
    <div className="flex flex-col gap-2 border bg-white px-5 py-4">
      <div className="flex items-center gap-2 text-neutral-700">
        {icon}
        <p className="text-lg">{label}</p>
      </div>
      <p className={cn("text-4xl font-bold", tone)}>{value}</p>
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

export function Table({ headers, children }: { headers: string[], children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
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
      {children}
    </tr>
  )
}

export function Cell({ children, className, title }: {
  children: ReactNode
  className?: string
  /** Native tooltip, for a column that shows an acronym and means a name. */
  title?: string
}) {
  return <td title={title} className={cn("px-3 py-2.5 text-neutral-800", className)}>{children}</td>
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
    <div className="flex items-center justify-between gap-3 pt-1">
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

export function Modal({ title, onClose, children, wide }: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className={cn("w-full border bg-white shadow-xl", wide ? "max-w-4xl" : "max-w-2xl")}>
        <header className="flex items-center justify-between border-b bg-linear-to-r from-red-300 to-orange-300 px-5 py-3">
          <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-2xl leading-none text-neutral-800 hover:text-black"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
