import type { EstadoAnuncio } from '../types'
import { BadgeDeMapa, type EtiquetaDeMapa } from './BadgeDeMapa'

// where an anuncio stands, as the backend derived it on a day (vigentes_a, al_dia): never from its dates here. vencido
// asks for a renovación; cesado and retirado are done with
export const ESTADOS_ANUNCIO: Record<EstadoAnuncio, EtiquetaDeMapa> = {
  VIGENTE: { texto: 'Vigente', tono: 'verde' },
  VENCIDO: { texto: 'Vencido', tono: 'rojo' },
  CESADO: { texto: 'Cesado', tono: 'ambar' },
  RETIRADO: { texto: 'Retirado', tono: '' }
}

export function EstadoAnuncioBadge({ estado }: { estado: EstadoAnuncio | null | undefined }) {
  return <BadgeDeMapa valor={estado} mapa={ESTADOS_ANUNCIO} />
}
