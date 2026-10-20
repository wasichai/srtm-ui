import type { FieldSpec } from '../../kit/forms/spec'
import { useMunicipalidad } from '../queries'
import type { Contribuyente, LugarMunicipal } from '../types'
import type { Picked } from './RecordPicker'
import { UbigeoFields } from './UbigeoFields'

// the field blocks and defaults the srtm's specs and pages repeat: one copy of each

// the cascade and the four fields it writes, as every address of the srtm asks them. spread it where the address goes:
// its place among the section's fields is its place in the form
export function ubigeoCampos(): FieldSpec[] {
  return [
    { name: 'ubigeo_cascada', label: 'Ubigeo', kind: 'custom', span: 6, render: (form) => <UbigeoFields form={form} /> },
    { name: 'ubigeo', label: 'Ubigeo', kind: 'hidden' },
    { name: 'departamento', label: 'Departamento', kind: 'hidden', required: true },
    { name: 'provincia', label: 'Provincia', kind: 'hidden', required: true },
    { name: 'distrito', label: 'Distrito', kind: 'hidden', required: true }
  ]
}

type Lleno<T> = { [K in keyof T]?: NonNullable<T[K]> }
const sinNulos = <T extends object>(valores: T): Lleno<T> =>
  Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== null && v !== undefined)) as Lleno<T>

// what a new address starts on: the place most of the organization's predios are in (GET /srtm/municipalidad's
// lugar), its ubigeo and the three names; a new predio its región besides. none (empty) when the backend gives none
export function lugarPorOmision(lugar: LugarMunicipal | null | undefined) {
  if (!lugar) return { ubigeo: {}, predio: {} }
  const ubigeo = sinNulos({ ubigeo: lugar.ubigeo, departamento: lugar.departamento, provincia: lugar.provincia, distrito: lugar.distrito })
  return { ubigeo, predio: sinNulos({ ...ubigeo, region: lugar.region }) }
}

// the organization's: cargando while GET /srtm/municipalidad is still on its way, for a form that starts on it
export function useLugar() {
  const municipalidad = useMunicipalidad()
  return { cargando: municipalidad.isPending, ...lugarPorOmision(municipalidad.data?.lugar) }
}

// the names of a catalog's rows, for a suggest field's list
export const nombres = (items: { nombre: string | null }[]) => items.map((i) => i.nombre ?? '').filter(Boolean)

// how a contribuyente shows in a picker: "{documento} · {nombre}"
export const describirContribuyente = (c: Contribuyente): Picked => ({ id: c.id!, label: `${c.numero_documento ?? 's/d'} · ${c.nombre_completo ?? ''}` })
