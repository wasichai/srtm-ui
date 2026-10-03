import { formatDate } from '../components/format'
import type { ClaseAnuncio, TipoAnuncio, TipoMovimientoAnuncio } from '../types'

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
