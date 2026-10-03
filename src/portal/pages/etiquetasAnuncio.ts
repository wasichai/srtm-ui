import { formatDate } from '../components/format'
import type { ClaseAnuncio, EstadoAnuncio, EstadoAnuncioAlDia, MovimientoAnuncio, TipoAnuncio, TipoMovimientoAnuncio } from '../types'

// the anuncios' enums in the clerk's words, in the model's order

export const CLASES_ANUNCIO: Record<ClaseAnuncio, string> = {
  LETRERO: 'Letrero',
  PANEL: 'Panel',
  TOLDO: 'Toldo',
  BANDEROLA: 'Banderola',
  PANTALLA_DIGITAL: 'Pantalla digital',
  GLOBO_AEROSTATICO: 'Globo aerostático'
}

export const TIPOS_ANUNCIO: Record<TipoAnuncio, string> = {
  AVISO_SIMPLE: 'Aviso simple',
  AVISO_LUMINOSO: 'Aviso luminoso',
  AVISO_ILUMINADO: 'Aviso iluminado',
  AVISO_ELECTRONICO: 'Aviso electrónico'
}

export const MOVIMIENTOS_ANUNCIO: Record<TipoMovimientoAnuncio, string> = {
  AUTORIZACION: 'Autorización',
  RENOVACION: 'Renovación',
  CESE: 'Cese',
  RETIRO: 'Retiro'
}

// a value of an enum in words, or as it came when out of the map
export const etiqueta = <K extends string>(mapa: Record<K, string>, valor: K | null | undefined) => (valor ? (mapa[valor] ?? valor) : '—')

// the vigencia in force as the backend sent it: without one, the anuncio has no term
export const vigenciaVigente = (hasta: string | null | undefined) => (hasta ? formatDate(hasta) : 'Sin plazo')

// the act that ends an anuncio's vigencia, by the estado it leaves it in
const TERMINOS: Partial<Record<EstadoAnuncio, { acto: TipoMovimientoAnuncio; texto: string }>> = {
  CESADO: { acto: 'CESE', texto: 'cesado' },
  RETIRADO: { acto: 'RETIRO', texto: 'retirado' }
}

// the vigencia at the backend's day: a cesado or retirado anuncio is in force no longer, whatever its last term said
export const vigenciaAlDia = ({ estado, vigencia_hasta_vigente }: EstadoAnuncioAlDia) => (TERMINOS[estado] ? '—' : vigenciaVigente(vigencia_hasta_vigente))

// «cesado el 01/02/2026», «retirado el …»: the date of its own movimiento (the last one of that act), when there is one
export function terminoDeVigencia(estado: EstadoAnuncio, movimientos: MovimientoAnuncio[]): string | null {
  const termino = TERMINOS[estado]
  if (!termino) return null
  const fechas = movimientos.filter((m) => m.tipo === termino.acto).map((m) => m.fecha)
  return fechas.length === 0 ? null : `${termino.texto} el ${formatDate(fechas.sort().at(-1))}`
}
