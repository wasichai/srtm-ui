import type { ResultadoRedeterminacion } from '../types'

// a write of a declaración (the DJ, its ficha, a row of its lists, a 204, the anulación, the rectificatoria, the
// recálculo, a condómino) can redetermine its predio's arbitrios (wasichai/srtm-backend#158): the answer then carries
// this header, {"redeterminadas":N,"anuladas":N,"pagadas":N,"error":null|"…"}, JSON with every non-ascii character escaped. absent
// when no redeterminación ran
export const ENCABEZADO_ARBITRIOS = 'Srtm-Arbitrios'

// the header as a ResultadoRedeterminacion: null when absent or unreadable (an aviso is never worth a failed write)
export function leerResultadoRedeterminacion(valor: string | null): ResultadoRedeterminacion | null {
  if (!valor) return null
  try {
    const r = JSON.parse(valor) as Record<string, unknown> | null
    if (!r || typeof r !== 'object') return null
    const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return {
      redeterminadas: numero(r.redeterminadas),
      anuladas: numero(r.anuladas),
      ...(typeof r.pagadas === 'number' ? { pagadas: numero(r.pagadas) } : {}),
      error: typeof r.error === 'string' && r.error ? r.error : null
    }
  } catch {
    return null
  }
}

export interface MensajeArbitrios {
  tono: 'success' | 'warning'
  texto: string
}

const cuotas = (n: number) => (n === 1 ? 'Se redeterminó 1 cuota' : `Se redeterminaron ${n} cuotas`)
const anuladas = (n: number) => (n === 1 ? '1 anulada' : `${n} anuladas`)

// what the clerk reads of a redeterminación: the cuotas when any changed, the error when one could not be done
// (both when the request summed several predios), nothing when nothing changed
export function mensajesDeRedeterminacion(r: ResultadoRedeterminacion, anio?: number): MensajeArbitrios[] {
  const mensajes: MensajeArbitrios[] = []
  const pagadas = r.pagadas ?? 0
  const yaPagadas = pagadas > 0 ? ` (${pagadas} ya ${pagadas === 1 ? 'pagada' : 'pagadas'} en caja, sin cambios)` : ''
  if (r.redeterminadas + r.anuladas > 0) {
    mensajes.push({
      tono: 'success',
      texto: `${cuotas(r.redeterminadas)} de arbitrios ${anio ? `de ${anio}` : 'del año'} (${anuladas(r.anuladas)})${yaPagadas}.`
    })
  } else if (pagadas > 0) {
    mensajes.push({ tono: 'success', texto: `Ninguna cuota de arbitrios cambió${yaPagadas}.` })
  }
  if (r.error) mensajes.push({ tono: 'warning', texto: `Los arbitrios no se redeterminaron: ${r.error}` })
  return mensajes
}

// the cuotas changed: what reads them is stale
export const cambiaronCuotas = (r: ResultadoRedeterminacion) => r.redeterminadas + r.anuladas > 0

// the portal's one channel for it: api.ts publishes what a response said, AvisosDeArbitrios shows it
type Oyente = (r: ResultadoRedeterminacion) => void
const oyentes = new Set<Oyente>()

export function escucharRedeterminaciones(oyente: Oyente): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function publicarRedeterminacion(r: ResultadoRedeterminacion) {
  for (const oyente of oyentes) oyente(r)
}

// a response's header, published when it is there
export function avisarDeArbitrios(response: Response) {
  const r = leerResultadoRedeterminacion(response.headers.get(ENCABEZADO_ARBITRIOS))
  if (r) publicarRedeterminacion(r)
}
