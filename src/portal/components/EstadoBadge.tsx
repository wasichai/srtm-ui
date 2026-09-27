import { Badge, cn } from '@wasichai/ui'

// a list row's ACTIVO / INACTIVO (none is ACTIVO), or a declaración's VIGENTE / ANULADA (none is VIGENTE)
const ETIQUETAS: Record<string, string> = { ACTIVO: 'Activo', VIGENTE: 'Vigente', ANULADA: 'Anulada' }

export function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  const valor = estado ?? 'ACTIVO'
  const activo = valor === 'ACTIVO' || valor === 'VIGENTE'
  const anulado = valor === 'ANULADA'
  return (
    <Badge className={cn('gap-1', anulado ? 'bg-danger/10 text-danger' : !activo && 'bg-surface-muted text-ink-muted')}>
      <span className={cn('size-1.5 rounded-full', activo ? 'bg-success' : anulado ? 'bg-danger' : 'bg-ink-muted')} />
      {ETIQUETAS[valor] ?? 'Inactivo'}
    </Badge>
  )
}

// an annulled declaración (a descargo) stays listed, marked, but counts in no totals and no condominio
export const anulada = (declaracion: { estado?: string | null }) => declaracion.estado === 'ANULADA'

// beside a declaración in a list: only an annulled one is marked
export function MarcaAnulada({ declaracion }: { declaracion: { estado?: string | null } }) {
  if (!anulada(declaracion)) return null
  return (
    <span className="ml-2 inline-flex align-middle">
      <EstadoBadge estado="ANULADA" />
    </span>
  )
}
