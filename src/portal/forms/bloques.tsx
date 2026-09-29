import type { FieldSpec } from '../../kit/forms/spec'
import type { Contribuyente } from '../types'
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

// the municipality's own district: what a new address starts on
export const PERENE_UBIGEO = { ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' } as const
// and a new predio, in the selva besides
export const PERENE_PREDIO = { ...PERENE_UBIGEO, region: 'SELVA' } as const

// the names of a catalog's rows, for a suggest field's list
export const nombres = (items: { nombre: string | null }[]) => items.map((i) => i.nombre ?? '').filter(Boolean)

// how a contribuyente shows in a picker: "{documento} · {nombre}"
export const describirContribuyente = (c: Contribuyente): Picked => ({ id: c.id!, label: `${c.numero_documento ?? 's/d'} · ${c.nombre_completo ?? ''}` })
