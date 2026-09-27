import type { ReactNode } from 'react'

export function FichaHeader({ kind, title, badges, aside }: { kind: ReactNode; title: string; badges?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{kind}</p>
        <h1 className="mt-0.5 text-xl font-semibold break-words text-ink">{title}</h1>
        {badges && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">{badges}</div>}
      </div>
      {aside}
    </div>
  )
}
