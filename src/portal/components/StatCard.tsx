import { Card } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDate } from './format'

// a figure with its name. fecha (iso) is the day it holds at, written under it ("al 03/10/2026"); nota says what the
// figure means or why there is none (a week's span, «no aplica»). the figure wraps rather than being cut: "S/ 1…" for
// S/ 10,000.50 would misinform
export function StatCard({ label, value, icon: Icon, fecha, nota }: { label: string; value: string; icon: LucideIcon; fecha?: string; nota?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <p className="text-lg font-semibold break-words text-ink tabular-nums">{value}</p>
        {fecha && <p className="text-xs text-ink-muted">al {formatDate(fecha)}</p>}
        {nota && <p className="text-xs text-ink-muted">{nota}</p>}
      </div>
    </Card>
  )
}

// a few figures in one card, stacked under its title: the portal's two-column ficha puts the year's under its tabs
// (FichaTabs' aside), where light and dark draw a StatCard each over them
export function ResumenCifras({ titulo, cifras }: { titulo: string; cifras: { label: string; value: string; icon: LucideIcon }[] }) {
  return (
    <Card className="mr-4 px-4 py-3.5">
      <h2 className="mb-3 text-xs font-bold tracking-wide text-ink-muted uppercase">{titulo}</h2>
      <ul className="flex flex-col gap-3">
        {cifras.map(({ label, value, icon: Icon }) => (
          <li key={label} className="flex items-center gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">{label}</p>
              <p className="truncate text-lg font-bold text-ink">{value}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
