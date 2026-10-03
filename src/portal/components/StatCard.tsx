import { Card } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDate } from './format'

// a figure with its name. fecha (iso) is the day it holds at, written under it ("al 03/10/2026"); nota says what the
// figure means or why there is none (a week's span, «no aplica»)
export function StatCard({ label, value, icon: Icon, fecha, nota }: { label: string; value: string; icon: LucideIcon; fecha?: string; nota?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <p className="truncate text-lg font-semibold text-ink">{value}</p>
        {fecha && <p className="text-xs text-ink-muted">al {formatDate(fecha)}</p>}
        {nota && <p className="text-xs text-ink-muted">{nota}</p>}
      </div>
    </Card>
  )
}
