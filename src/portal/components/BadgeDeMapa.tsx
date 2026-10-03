import { Badge, cn } from '@wasichai/ui'
import { useVarianteTema } from '../../themes'
import type { Tono } from './tono'

// what a value of an enum reads as, and its tone
export interface EtiquetaDeMapa {
  texto: string
  tono: Tono
}

const TEXTO: Record<Tono, string> = { verde: 'text-success', ambar: 'text-warning', rojo: 'text-danger', '': 'text-ink' }
const PILDORA: Record<Tono, string> = {
  verde: 'bg-success/10 text-success',
  ambar: 'bg-warning/10 text-warning',
  rojo: 'bg-danger/10 text-danger',
  '': 'bg-surface-muted text-ink-muted'
}

// a state the backend decided (a fase, an estado), read through an explicit map: never tonoDeEstado's guesses, which
// paint "vencida" red and call any unknown value "Inactivo". a value out of the map shows as it came, untoned; null is
// "—". a pill in the classic themes; portal-tributario writes it as bold text in its tone, like EstadoBadge
export function BadgeDeMapa({ valor, mapa }: { valor: string | null | undefined; mapa: Record<string, EtiquetaDeMapa> }) {
  const variante = useVarianteTema()
  if (valor === null || valor === undefined || valor === '') return <span className="text-ink-muted">—</span>
  const { texto, tono } = mapa[valor] ?? { texto: valor, tono: '' as Tono }
  if (variante === 'portal') {
    return (
      <span data-ui="estado" data-tono={tono} className={cn('text-[12.5px] font-bold', TEXTO[tono])}>
        {texto}
      </span>
    )
  }
  return (
    <Badge data-ui="estado" data-tono={tono} className={PILDORA[tono]}>
      {texto}
    </Badge>
  )
}
