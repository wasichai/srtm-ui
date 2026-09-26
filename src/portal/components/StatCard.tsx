import { Card } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'

export function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <p className="truncate text-lg font-semibold text-ink">{value}</p>
      </div>
    </Card>
  )
}
