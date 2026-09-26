import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { AlertTriangle, Inbox, Loader2, Lock, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-ink-muted">
      <Inbox className="size-8 text-border" />
      <p className="font-medium text-ink">{title}</p>
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0
  const [Icon, title] =
    status === 404 ? [SearchX, 'No se encontró el registro'] : status === 403 ? [Lock, 'No tienes permiso para ver esto'] : [AlertTriangle, 'No se pudo cargar']
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-sm">
      <Icon className="size-8 text-danger" />
      <p className="font-medium text-ink">{title}</p>
      {error instanceof Error && status !== 404 && status !== 403 && <p className="text-ink-muted">{error.message}</p>}
      {onRetry && status !== 404 && status !== 403 && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

// loading, error or the data, in that order
export function QueryState<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  return children(query.data)
}
