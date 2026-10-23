import type { ResumenCaja } from '../types'
import type { MensajeArbitrios } from './avisoArbitrios'

// a write of srtm answers with what it did to its contribuyentes' ordenes in caja (wasichai/srtm-backend#164): the
// header, {"encoladas":N,"enviadas":N,"sustituidas":N,"retiradas":N,"pagadas_en_caja":N,"conflictos":N,"pendientes":N,
// "error":null|"…"}, JSON with every non-ascii character escaped. absent when no sincronización ran
export const ENCABEZADO_CAJA = 'Srtm-Caja'

// the header as a ResumenCaja: null when absent or unreadable (an aviso is never worth a failed write)
export function leerResumenCaja(valor: string | null): ResumenCaja | null {
  if (!valor) return null
  try {
    const r = JSON.parse(valor) as Record<string, unknown> | null
    if (!r || typeof r !== 'object') return null
    const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return {
      encoladas: numero(r.encoladas),
      enviadas: numero(r.enviadas),
      sustituidas: numero(r.sustituidas),
      retiradas: numero(r.retiradas),
      pagadas_en_caja: numero(r.pagadas_en_caja),
      conflictos: numero(r.conflictos),
      pendientes: numero(r.pendientes),
      error: typeof r.error === 'string' && r.error ? r.error : null
    }
  } catch {
    return null
  }
}

// the header's counts in its order, each with its words: the first one names the ordenes, the rest only say what
// became of them
const CUENTAS: { clave: keyof ResumenCaja; uno: string; varias: string }[] = [
  { clave: 'encoladas', uno: 'encolada', varias: 'encoladas' },
  { clave: 'enviadas', uno: 'enviada', varias: 'enviadas' },
  { clave: 'sustituidas', uno: 'sustituida', varias: 'sustituidas' },
  { clave: 'retiradas', uno: 'retirada', varias: 'retiradas' },
  { clave: 'pagadas_en_caja', uno: 'pagada en caja', varias: 'pagadas en caja' },
  { clave: 'conflictos', uno: 'en conflicto', varias: 'en conflicto' },
  { clave: 'pendientes', uno: 'pendiente', varias: 'pendientes' }
]

// what the clerk reads of a sincronización: the counts that are not 0 (a warning when one is a conflict), and the
// error when caja did not answer; nothing when nothing happened
export function mensajesDeCaja(r: ResumenCaja): MensajeArbitrios[] {
  const mensajes: MensajeArbitrios[] = []
  const partes: string[] = []
  for (const { clave, uno, varias } of CUENTAS) {
    const n = (r[clave] as number | undefined) ?? 0
    if (n <= 0) continue
    const orden = partes.length === 0 ? (n === 1 ? ' orden' : ' órdenes') : ''
    partes.push(`${n}${orden} ${n === 1 ? uno : varias}`)
  }
  if (partes.length > 0) mensajes.push({ tono: r.conflictos > 0 ? 'warning' : 'success', texto: `Caja: ${partes.join(', ')}` })
  if (r.error) mensajes.push({ tono: 'warning', texto: `Caja no respondió: ${r.error}` })
  return mensajes
}

// the ordenes changed: what reads them is stale (pendientes alone are what is left to the loop)
export const cambioCaja = (r: ResumenCaja) => r.encoladas + r.enviadas + r.sustituidas + r.retiradas + r.pagadas_en_caja + r.conflictos > 0

// the portal's one channel for it: api.ts publishes what a response said, AvisosDeArbitrios shows it
type Oyente = (r: ResumenCaja) => void
const oyentes = new Set<Oyente>()

export function escucharCaja(oyente: Oyente): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function publicarCaja(r: ResumenCaja) {
  for (const oyente of oyentes) oyente(r)
}

// a response's header, published when it is there
export function avisarDeCaja(response: Response) {
  const r = leerResumenCaja(response.headers.get(ENCABEZADO_CAJA))
  if (r) publicarCaja(r)
}
