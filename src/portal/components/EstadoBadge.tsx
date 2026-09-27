import { Badge, cn } from '@wasichai/ui'

export function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  const activo = (estado ?? 'ACTIVO') === 'ACTIVO'
  return (
    <Badge className={cn('gap-1', !activo && 'bg-surface-muted text-ink-muted')}>
      <span className={cn('size-1.5 rounded-full', activo ? 'bg-success' : 'bg-ink-muted')} />
      {activo ? 'Activo' : 'Inactivo'}
    </Badge>
  )
}
