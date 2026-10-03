import type { FaseProcedimiento } from '../types'
import { BadgeDeMapa, type EtiquetaDeMapa } from './BadgeDeMapa'

// where an acta's procedure stands, as the backend computed it on fase_al_dia: preventiva while a notificación previa
// runs, constatada with the acta, sancionada with its RIS. null (an annulled acta, or one left without effect) is "—":
// its estado de la deuda says why, never the nearest fase
export const FASES: Record<FaseProcedimiento, EtiquetaDeMapa> = {
  PREVENTIVA: { texto: 'Preventiva', tono: 'ambar' },
  CONSTATADA: { texto: 'Constatada', tono: 'ambar' },
  SANCIONADA: { texto: 'Sancionada', tono: 'rojo' }
}

export function FaseBadge({ fase }: { fase: FaseProcedimiento | null | undefined }) {
  return <BadgeDeMapa valor={fase} mapa={FASES} />
}
