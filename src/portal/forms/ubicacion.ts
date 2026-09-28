import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import type { CatastroFiscal, Predio, Ubigeo } from '../types'
import { BLOQUEADOS, bloqueados, bloquear } from './bloqueo'
import type { FormValues } from './specs'

// what "buscar predios" hands to a ubicación form: a lote of the catastro fiscal or a predio of the padrón

export type Elegido = { kind: 'predio'; predio: Predio } | { kind: 'catastro'; lote: CatastroFiscal; predio: Predio | null }

// a lote's data as a predio's ubicación. its municipal code (the predio's code in the padrón) is shown, not sent: the
// backend gives a new predio the code of the lote with its CPU. the lote carries the ubigeo code only: with the INEI
// list, its departamento, provincia and distrito too
export function ubicacionDeLote(lote: CatastroFiscal, ubigeos?: Ubigeo[]): Partial<Predio> {
  const lugar = lote.ubigeo ? ubigeos?.find((u) => u.codigo === lote.ubigeo) : undefined
  return {
    codigo: lote.codigo_predio_municipal,
    codigo_cpu: lote.codigo_cpu,
    partida_registral: lote.partida_registral,
    tipo_predio: lote.tipo_predio,
    ubigeo: lote.ubigeo,
    tipo_via: lote.tipo_via,
    via: lote.via,
    numero: lote.numero,
    tipo_zona: lote.tipo_zona,
    habilitacion_urbana: lote.zona,
    manzana: lote.manzana,
    lote: lote.lote,
    kilometro: lote.kilometro,
    lote_geom: lote.lote_geom ?? null,
    ...(lugar ? { departamento: lugar.departamento, provincia: lugar.provincia, distrito: lugar.distrito } : {})
  }
}

// what came from the catastro: the fields a lote filled with a value (page 14 shows them greyed)
export const camposDelLote = (values: Partial<Predio>) =>
  Object.entries(values)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k]) => k)

const UBICACION_CAMPOS = [
  'codigo',
  'codigo_cpu',
  'partida_registral',
  'tipo_predio',
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

// a predio already in the padrón shows its own code. one showing a lote's (a new predio opened from it) shows the next
// lote's
function codigoPropio(form: UseFormReturn<FormValues>): boolean {
  const inicial = form.formState.defaultValues ?? {}
  return Boolean(inicial.codigo) && !bloqueados({ [BLOQUEADOS]: inicial[BLOQUEADOS] ?? '' }).includes('codigo')
}

// writes what was picked into a ubicación form. only what it knows: a lote leaves the rest as it was typed, and what
// it filled stays greyed until "desbloquear". a predio of the padrón lends its ubicación, not its code.
// a lote carries the ubigeo code only: its departamento, provincia and distrito come from the INEI list
export async function llenarUbicacion(form: UseFormReturn<FormValues>, elegido: Elegido) {
  const source: Partial<Predio> = elegido.kind === 'predio' ? elegido.predio : ubicacionDeLote(elegido.lote)
  const values: Partial<Record<string, unknown>> = { ...source }
  if (source.ubigeo && !source.distrito) {
    const lugar = (await rentas.ubigeos()).find((u) => u.codigo === source.ubigeo)
    if (lugar) Object.assign(values, { departamento: lugar.departamento, provincia: lugar.provincia, distrito: lugar.distrito })
  }
  if (elegido.kind === 'predio' || codigoPropio(form)) delete values.codigo
  for (const name of UBICACION_CAMPOS) {
    if (!(name in values)) continue
    const value = values[name]
    if (value === undefined) continue
    const text = value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    form.setValue(name, text, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }
  bloquear(form, elegido.kind === 'catastro' ? camposDelLote(values as Partial<Predio>) : [])
}
