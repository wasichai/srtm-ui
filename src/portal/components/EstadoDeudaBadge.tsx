import type { EstadoDeuda } from '../types'
import { BadgeDeMapa, type EtiquetaDeMapa } from './BadgeDeMapa'

// what is left of an acta's multa, as the backend says: pendiente while it stands, anulada, or dejada sin efecto by a
// resolución. never paid nor in coactiva (srtm does not collect). it goes beside the fase, with its own name: never
// one in place of the other
export const ESTADOS_DEUDA: Record<EstadoDeuda, EtiquetaDeMapa> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'ambar' },
  ANULADA: { texto: 'Anulada', tono: '' },
  DEJADA_SIN_EFECTO: { texto: 'Dejada sin efecto', tono: '' }
}

export function EstadoDeudaBadge({ estado }: { estado: EstadoDeuda | null | undefined }) {
  return <BadgeDeMapa valor={estado} mapa={ESTADOS_DEUDA} />
}
