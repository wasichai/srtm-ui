import { Badge, cn } from '@wasichai/ui'
import { useVarianteTema } from '../../themes'
import { tonoDeEstado, type Tono } from './tono'

// a list row's ACTIVO / INACTIVO (none is ACTIVO), or a declaración's VIGENTE / ANULADA (none is VIGENTE)
const ETIQUETAS: Record<string, string> = { ACTIVO: 'Activo', VIGENTE: 'Vigente', ANULADA: 'Anulada' }

const COLOR: Record<Tono, string> = { verde: 'text-success', ambar: 'text-warning', rojo: 'text-danger', '': 'text-ink' }

// the srtm's dark pill: "● Activo". the portal-tributario theme writes it as bold text in its tone, no pill
export function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  const variante = useVarianteTema()
  const valor = estado ?? 'ACTIVO'
  const texto = ETIQUETAS[valor] ?? 'Inactivo'
  if (variante === 'portal') {
    const tono = tonoDeEstado(texto)
    return (
      <span data-ui="estado" data-tono={tono} className={cn('text-[12.5px] font-bold', COLOR[tono])}>
        {texto}
      </span>
    )
  }
  const activo = valor === 'ACTIVO' || valor === 'VIGENTE'
  const anulado = valor === 'ANULADA'
  return (
    <Badge className={cn('gap-1', activo ? 'bg-ink text-surface' : anulado ? 'bg-danger/10 text-danger' : 'bg-surface-muted text-ink-muted')}>
      <span className={cn('size-1.5 rounded-full', activo ? 'bg-surface' : anulado ? 'bg-danger' : 'bg-ink-muted')} />
      {texto}
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
