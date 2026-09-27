import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import type { CatastroFiscal, Predio } from '../types'
import type { FormValues } from './specs'

// what "buscar predios" hands to a ubicación form: a lote of the catastro fiscal or a predio of the padrón

export type Elegido = { kind: 'predio'; predio: Predio } | { kind: 'catastro'; lote: CatastroFiscal; predio: Predio | null }

// the catastro writes PREDIO URBANO, the padrón URBANO
export const condicionDe = (tipoPredio: string | null | undefined) => (tipoPredio ? tipoPredio.replace(/^PREDIO /, '') : null)

// a lote's data as a predio's ubicación
export function ubicacionDeLote(lote: CatastroFiscal): Partial<Predio> {
  return {
    codigo_cpu: lote.codigo_cpu,
    partida_registral: lote.partida_registral,
    condicion: condicionDe(lote.tipo_predio),
    ubigeo: lote.ubigeo,
    tipo_via: lote.tipo_via,
    via: lote.via,
    numero: lote.numero,
    tipo_zona: lote.tipo_zona,
    habilitacion_urbana: lote.zona,
    manzana: lote.manzana,
    lote: lote.lote,
    kilometro: lote.kilometro,
    lote_geom: lote.lote_geom ?? null
  }
}

const UBICACION_CAMPOS = [
  'codigo_cpu',
  'partida_registral',
  'condicion',
  'region',
  'ubigeo',
  'departamento',
  'provincia',
  'distrito',
  'tipo_via',
  'via',
  'numero',
  'numero_alterno',
  'letra1',
  'letra2',
  'manzana',
  'ucv',
  'lote',
  'sub_lote',
  'kilometro',
  'edificacion',
  'descripcion_edificacion',
  'interior',
  'descripcion_interior',
  'piso',
  'ingreso',
  'tipo_zona',
  'habilitacion_urbana',
  'sub_zona',
  'descripcion_sub_zona',
  'referencia',
  'lote_geom'
] as const

// writes what was picked into a ubicación form. only what it knows: a lote leaves the rest as it was typed.
// a lote carries the ubigeo code only: its departamento, provincia and distrito come from the INEI list
export async function llenarUbicacion(form: UseFormReturn<FormValues>, elegido: Elegido) {
  const source: Partial<Predio> = elegido.kind === 'predio' ? elegido.predio : ubicacionDeLote(elegido.lote)
  const values: Partial<Record<string, unknown>> = { ...source }
  if (source.ubigeo && !source.distrito) {
    const lugar = (await rentas.ubigeos()).find((u) => u.codigo === source.ubigeo)
    if (lugar) Object.assign(values, { departamento: lugar.departamento, provincia: lugar.provincia, distrito: lugar.distrito })
  }
  for (const name of UBICACION_CAMPOS) {
    if (!(name in values)) continue
    const value = values[name]
    if (value === undefined) continue
    const text = value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    form.setValue(name, text, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }
}
