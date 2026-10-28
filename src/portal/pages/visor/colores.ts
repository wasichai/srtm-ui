import { colorExpression, legendItems, type LegendItem, type StyleClasses } from '@wasichai/gis'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { CategoriaBrecha, Confianza, DecisionBrecha } from '../../types'
import { CATEGORIAS, CONFIANZAS } from '../BrechaPage'
import { DECISIONES } from '../reportes/comun'
import { soles } from './formato'
import type { EstadoNivel } from './tipos'

// the fixed colours of the visor: the map, its legend, the chips and the bars all read them from here. they are
// catastro-ui's (src/brechas/colores.ts), so the visor of srtm and that of catastro paint a lote alike; the names are
// srtm's (BrechaPage's CATEGORIAS and CONFIANZAS, Reportes' DECISIONES). hex, because maplibre does not read the oklch
// of wasichai's themes. OMISO (red) and COINCIDE (teal) are told apart with deuteranopia too
export const GRIS = '#9ca3af'

export const COLOR_CATEGORIA: Record<CategoriaBrecha, string> = {
  OMISO: '#e15759',
  SUBVALUADO: '#f28e2b',
  SIN_VALOR: '#edc948',
  SIN_CATASTRO: '#b07aa1',
  SOBREVALUADO: '#4e79a7',
  COINCIDE: '#76b7b2',
  SIN_LEVANTAR: GRIS
}

export const COLOR_CONFIANZA: Record<Confianza, string> = { CONFIABLE: '#4e79a7', DUDOSO: '#f28e2b', SIN_LEVANTAR: GRIS }

export const COLOR_ESTADO: Record<DecisionBrecha, string> = {
  PENDIENTE: '#76b7b2',
  A_INSPECCIONAR: '#f28e2b',
  INSPECCIONADO: '#4e79a7',
  A_FISCALIZAR: '#e15759',
  DESCARTADO: GRIS
}

// a piso in both (blue, as CONFIABLE), only declared (orange), only surveyed (red, as OMISO: area the municipalidad
// does not charge) or that srtm could not match (grey)
export const COLOR_NIVEL: Record<EstadoNivel, string> = { PAR: '#4e79a7', SOLO_RENTAS: '#f28e2b', SOLO_CATASTRO: '#e15759', AMBIGUO: GRIS }

export const ETIQUETA_NIVEL: Record<EstadoNivel, string> = {
  PAR: 'En ambos',
  SOLO_RENTAS: 'Solo en rentas',
  SOLO_CATASTRO: 'Solo en catastro',
  AMBIGUO: 'Ambiguo'
}

const deCada = <K extends string, V>(origen: Record<K, V>, nombre: (v: V) => string) =>
  Object.fromEntries(Object.entries(origen).map(([k, v]) => [k, nombre(v as V)])) as Record<K, string>

export const ETIQUETA_CATEGORIA = deCada(CATEGORIAS, (c) => c.singular)
export const ETIQUETA_CONFIANZA = deCada(CONFIANZAS, (c) => c.nombre)
export const ETIQUETA_ESTADO = deCada(DECISIONES, (d) => d.nombre)

export const etiquetaCategoria = (c: CategoriaBrecha | null | undefined) => (c ? (ETIQUETA_CATEGORIA[c] ?? c) : '—')
export const etiquetaConfianza = (c: Confianza | null | undefined) => (c ? (ETIQUETA_CONFIANZA[c] ?? c) : 'Sin confianza')
export const colorConfianza = (c: Confianza | null | undefined) => (c ? (COLOR_CONFIANZA[c] ?? GRIS) : GRIS)
// no estado: catastro's decisions could not be read
export const etiquetaEstado = (e: DecisionBrecha | null | undefined) => (e ? (ETIQUETA_ESTADO[e] ?? e) : 'Sin dato')

// the difference of impuesto (catastro − declarado) on a diverging scale centred on 0: reds where catastro would
// charge more, blues where less, a light grey for no change. the classes are fixed and symmetric, so a colour means
// the same in every corrida and under every filter
export const DIVERGENTE = {
  // strongest to weakest
  baja: ['#2166ac', '#67a9cf', '#d1e5f0'],
  // a light grey, not white: the lotes «sin cambio» (most of them) stay visible on the basemap
  neutro: '#e0e0e0',
  // weakest to strongest
  sube: ['#fddbc7', '#ef8a62', '#b2182b']
} as const

// below S/ 1 either way is «no change»
export const UMBRAL = 1
export const MAGNITUDES = [50, 500] as const
const [A, B] = MAGNITUDES

export function colorDelta(): ExpressionSpecification {
  const { baja, neutro, sube } = DIVERGENTE
  return [
    'case',
    ['==', ['typeof', ['get', 'delta_impuesto']], 'number'],
    ['step', ['get', 'delta_impuesto'], baja[0], -B, baja[1], -A, baja[2], -UMBRAL, neutro, UMBRAL, sube[0], A, sube[1], B, sube[2]],
    GRIS
  ] as ExpressionSpecification
}

const s = (n: number) => soles(n, { minimo: 0, maximo: 0, signo: true })

// the legend of the diverging scale, from the largest rise to the largest drop
export const LEYENDA_DELTA: LegendItem[] = [
  { color: DIVERGENTE.sube[2], label: `${s(B)} o más` },
  { color: DIVERGENTE.sube[1], label: `${s(A)} a ${s(B)}` },
  { color: DIVERGENTE.sube[0], label: `${s(UMBRAL)} a ${s(A)}` },
  { color: DIVERGENTE.neutro, label: `Sin cambio (${s(-UMBRAL)} a ${s(UMBRAL)})` },
  { color: DIVERGENTE.baja[2], label: `${s(-A)} a ${s(-UMBRAL)}` },
  { color: DIVERGENTE.baja[1], label: `${s(-B)} a ${s(-A)}` },
  { color: DIVERGENTE.baja[0], label: `Menos de ${s(-B)}` },
  { color: GRIS, label: 'Sin dato (sin levantar)' }
]

// the colour of a difference outside the map (the bars of the sectores): the strongest of its side
export const colorDeSigno = (n: number) => (n < 0 ? DIVERGENTE.baja[0] : DIVERGENTE.sube[2])

export type Colorear = 'categoria' | 'delta' | 'confianza' | 'estado'

export const COLOREAR: Record<Colorear, string> = {
  categoria: 'Categoría',
  delta: 'Diferencia de impuesto (catastro − declarado)',
  confianza: 'Confianza',
  estado: 'Estado'
}

const CATEGORICOS = {
  categoria: [COLOR_CATEGORIA, ETIQUETA_CATEGORIA],
  confianza: [COLOR_CONFIANZA, ETIQUETA_CONFIANZA],
  estado: [COLOR_ESTADO, ETIQUETA_ESTADO]
} as const

// a categorical colouring in gis' shape (StyleClasses): one class per key, with its fixed colour and its name
export function clasesDeLote(modo: Exclude<Colorear, 'delta'>): StyleClasses {
  const [colores, etiquetas] = CATEGORICOS[modo]
  return {
    by: modo,
    type: 'categories',
    classes: Object.entries(colores).map(([clave, color]) => ({ value: clave, color, label: (etiquetas as Record<string, string>)[clave] }))
  }
}

// the fill of a lote under each colouring: gis' match on the key (grey for anything else), or the diverging scale
export function colorDeLote(modo: Colorear): ExpressionSpecification {
  if (modo === 'delta') return colorDelta()
  return colorExpression(clasesDeLote(modo)) as ExpressionSpecification
}

// the legend entries of a colouring, the same colours the map paints with
export function leyendaDe(modo: Colorear): LegendItem[] {
  return modo === 'delta' ? LEYENDA_DELTA : legendItems(clasesDeLote(modo))
}

// the minimum difference typed, when it is a number of 0 or more; the API refuses a negative one
export function minimoValido(texto: string): number | null {
  const n = Number(texto)
  return texto.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

// the vías: a sequential palette (light to dark = cheaper to dearer) in quantile classes of their valor_m2, as
// catastro-ui's «Aranceles por vía» paints them
export const PALETA = ['#fee391', '#fec44f', '#fe9929', '#d95f0e', '#993404'] as const

// the 4 cut points that split the values into 5 quantile classes, in whole soles, strictly ascending (maplibre's step
// needs that): repeated values collapse, so there may be fewer than 5 classes, or none
export function cortes(valores: number[]): number[] {
  const orden = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!orden.length) return []
  const puntos: number[] = []
  for (let i = 1; i < PALETA.length; i++) {
    const corte = Math.round(orden[Math.min(orden.length - 1, Math.floor((i * orden.length) / PALETA.length))])
    if (!puntos.length || corte > puntos[puntos.length - 1]) puntos.push(corte)
  }
  // a cut at the minimum would leave the first class empty
  while (puntos.length && puntos[0] <= Math.round(orden[0])) puntos.shift()
  return puntos
}

export function valoresDe(features: { properties: object }[], campo = 'valor_m2'): number[] {
  return features.flatMap((f) => {
    const v = (f.properties as Record<string, unknown>)[campo]
    return typeof v === 'number' ? [v] : []
  })
}

const enteros = (n: number) => soles(n, { minimo: 0, maximo: 0 })

// the quantile classes of the values in gis' shape, so the map paints them with colorExpression and the legend lists
// them with legendItems
export function clasesPorValor(valores: number[], campo = 'valor_m2'): StyleClasses {
  valores = valores.filter((v) => Number.isFinite(v))
  const clases: StyleClasses = { by: campo, type: 'quantiles', classes: [] }
  if (!valores.length) return clases
  const minimo = Math.floor(valores.reduce((a, b) => Math.min(a, b)))
  const dados = cortes(valores)
  if (!dados.length) return { ...clases, classes: [{ color: PALETA[PALETA.length - 1], label: 'Todos los valores', min: minimo }] }
  const ultimo = dados.length
  return {
    ...clases,
    classes: Array.from({ length: ultimo + 1 }, (_, i) => ({
      color: PALETA[i],
      min: i === 0 ? minimo : dados[i - 1],
      ...(i < ultimo ? { max: dados[i] } : {}),
      label:
        i === 0
          ? `Menos de ${enteros(dados[0])}`
          : i === ultimo
            ? `${enteros(dados[ultimo - 1])} o más`
            : `${enteros(dados[i - 1])} a menos de ${enteros(dados[i])}`
    }))
  }
}

// the line colour of the classes: gis' expression, or the darkest colour before there are classes
export function colorPorValor(clases: StyleClasses | undefined): string | ExpressionSpecification {
  return clases?.classes.length ? (colorExpression(clases) as string | ExpressionSpecification) : PALETA[PALETA.length - 1]
}
