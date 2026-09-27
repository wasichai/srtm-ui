import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import type { CatalogKey } from '../types'
import { errorDocumento, pideNumero, SIN_DOCUMENTO } from './documento'
import { UbigeoFields } from './UbigeoFields'

// how each entity shows and edits: sections, labels and value kinds. names are the model's fields.
// the srtm screens lay a section out on six columns; span says how many a field takes

export type FieldKind =
  'text' | 'longtext' | 'enum' | 'integer' | 'decimal' | 'money' | 'date' | 'month' | 'boolean' | 'multi' | 'suggest' | 'hidden' | 'geometry' | 'custom'

// the form's values, as the inputs hold them (strings)
export type FormValues = Record<string, string>

export interface FieldSpec {
  name: string
  label: string
  kind?: FieldKind
  // a function when it depends on another field (nombres only for a persona natural)
  required?: boolean | ((values: FormValues) => boolean)
  // shown, validated and sent only while this holds
  when?: (values: FormValues) => boolean
  // shown always, but greyed (and neither required nor sent) until this holds: the srtm's dependent fields
  enabledWhen?: (values: FormValues) => boolean
  // what it shows while greyed, from the live and the stored values (default: nothing)
  greyedValue?: (values: FormValues, stored: FormValues) => string
  // a filled field's own check (a document number by its tipo): true, or the message
  validate?: (value: string, values: FormValues) => true | string
  // kind multi: the choices, kept as one comma-separated text
  choices?: string[]
  // the backend's (codigo, fecha del registro...): shown, never edited
  readOnly?: boolean
  placeholder?: string
  span?: 1 | 2 | 3 | 4 | 6
  // kind suggest: free text with catalog suggestions
  suggest?: (q: string, values: FormValues) => Promise<string[]>
  // kind custom: its own inputs, bound to hidden fields of the same form (not sent itself)
  render?: (form: UseFormReturn<FormValues>) => ReactNode
  // kind hidden: listed in the ficha all the same (the uso's cascade edits three of them)
  shownInFicha?: boolean
}

export interface SectionSpec {
  title: string
  // the srtm's numbered circles: 1 datos de la declaración, 2 identificación...
  number?: number
  // on the right of the section's title (the ubicación's "buscar predios")
  action?: (form: UseFormReturn<FormValues>) => ReactNode
  fields: FieldSpec[]
}

export type { CatalogKey }

const AUTO = '(AUTOGENERADO)'

// a persona natural (or sociedad conyugal) has surnames and names; everyone else a razón social.
// imported contribuyentes have no tipo_contribuyente yet: their tipo_persona decides
export const esPersonaNatural = (v: FormValues) =>
  v.tipo_contribuyente ? ['PERSONA NATURAL', 'SOCIEDAD CONYUGAL'].includes(v.tipo_contribuyente) : v.tipo_persona !== 'JURIDICA'

export const CONTRIBUYENTE_SECTIONS: SectionSpec[] = [
  {
    title: 'Datos de la declaración',
    number: 1,
    fields: [
      { name: 'codigo', label: 'Código de contribuyente', readOnly: true, placeholder: AUTO, span: 1 },
      { name: 'numero_declaracion', label: 'Número de declaración', kind: 'integer', readOnly: true, placeholder: AUTO, span: 1 },
      { name: 'fecha_registro', label: 'Fecha del registro', kind: 'date', readOnly: true, placeholder: AUTO, span: 1 },
      { name: 'motivo', label: 'Motivo', kind: 'enum', readOnly: true, placeholder: 'INSCRIPCION', span: 1 },
      { name: 'medio_determinacion', label: 'Medio de determinación', kind: 'enum', readOnly: true, placeholder: 'DECLARACION JURADA', span: 1 },
      { name: 'medio_presentacion', label: 'Medio de presentación', kind: 'enum', required: true, span: 1 },
      { name: 'modificacion_oficio', label: 'Modificación de oficio', kind: 'enum', readOnly: true, span: 1 },
      { name: 'fecha_presentacion', label: 'Fecha de presentación', kind: 'date', required: true, span: 1 },
      { name: 'tipo_contribuyente', label: 'Tipo de contribuyente', kind: 'enum', required: true, span: 2 },
      { name: 'codigo_anterior', label: 'Cód. contribuyente anterior', span: 1 },
      // what the lists and the padrón use, derived from tipo_contribuyente by the backend
      { name: 'tipo_persona', label: 'Tipo de persona', kind: 'hidden' }
    ]
  },
  {
    title: 'Datos de identificación',
    number: 2,
    fields: [
      { name: 'tipo_documento', label: 'Tipo de documento', kind: 'enum', required: true, span: 1 },
      // greyed until a tipo is chosen, and for SIN DOCUMENTO: none for a new one or one switched to it, the padrón's
      // number for one that already was (the backend keeps it: the importer knows it by it)
      {
        name: 'numero_documento',
        label: 'N° documento',
        required: true,
        span: 2,
        enabledWhen: (v) => pideNumero(v.tipo_documento),
        greyedValue: (v, stored) => (v.tipo_documento === SIN_DOCUMENTO && stored.tipo_documento === SIN_DOCUMENTO ? stored.numero_documento : ''),
        validate: (value, v) => errorDocumento(v.tipo_documento, value) ?? true
      },
      { name: 'fuente_informacion', label: 'Fuente información', kind: 'enum', required: true, span: 1 }
    ]
  },
  {
    title: 'Datos personales',
    number: 3,
    fields: [
      { name: 'apellido_paterno', label: 'Apellido paterno', span: 1, when: esPersonaNatural },
      { name: 'apellido_materno', label: 'Apellido materno', span: 1, when: esPersonaNatural },
      { name: 'nombres', label: 'Nombres', required: true, span: 1, when: esPersonaNatural },
      { name: 'fecha_nacimiento', label: 'Fecha nacimiento', kind: 'date', span: 1, when: esPersonaNatural },
      { name: 'fecha_fallecimiento', label: 'Fecha fallecimiento', kind: 'date', span: 1, when: esPersonaNatural },
      { name: 'estado_civil', label: 'Estado civil', kind: 'enum', required: true, span: 1, when: esPersonaNatural },
      { name: 'sexo', label: 'Sexo', kind: 'enum', required: true, span: 1, when: esPersonaNatural },
      { name: 'razon_social', label: 'Razón social', required: true, span: 4, when: (v) => !esPersonaNatural(v) },
      { name: 'nombre_completo', label: 'Nombre completo', kind: 'hidden' },
      { name: 'observacion', label: 'Observación', kind: 'longtext', span: 6, placeholder: 'OBSERVACIÓN' }
    ]
  }
]

// the address one-liner lives with the ubicación's (forms/direccion.ts)
export { describirDomicilio } from './direccion'

const nombres = (items: { nombre: string | null }[]) => items.map((i) => i.nombre ?? '').filter(Boolean)

export const DOMICILIO_SECTIONS: SectionSpec[] = [
  {
    title: 'Datos del domicilio',
    fields: [
      { name: 'tipo_domicilio', label: 'Tipo de domicilio', kind: 'enum', required: true, span: 1 },
      { name: 'tipo_predio', label: 'Tipo de predio', kind: 'enum', required: true, span: 1 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 1 },
      { name: 'ubigeo_cascada', label: 'Ubigeo', kind: 'custom', span: 6, render: (form) => <UbigeoFields form={form} /> },
      { name: 'ubigeo', label: 'Ubigeo', kind: 'hidden' },
      { name: 'departamento', label: 'Departamento', kind: 'hidden', required: true },
      { name: 'provincia', label: 'Provincia', kind: 'hidden', required: true },
      { name: 'distrito', label: 'Distrito', kind: 'hidden', required: true },
      { name: 'tipo_unidad_urbana', label: 'Tipo unidad urbana', kind: 'enum', span: 1 },
      {
        name: 'unidad_urbana',
        label: 'Descripción unidad urbana',
        kind: 'suggest',
        // an address may have no unidad urbana, or no street ("Mz/Lt, AA.HH."): each is asked only with its tipo
        required: (v) => !!v.tipo_unidad_urbana,
        span: 2,
        suggest: async (q, v) => nombres((await rentas.unidadesUrbanas(q, v.tipo_unidad_urbana, v.ubigeo)).content)
      },
      { name: 'tipo_via', label: 'Tipo de vía', kind: 'enum', span: 1 },
      {
        name: 'via',
        label: 'Descripción de la vía',
        kind: 'suggest',
        required: (v) => !!v.tipo_via,
        span: 2,
        suggest: async (q, v) => nombres((await rentas.vias(q, v.tipo_via, v.ubigeo)).content)
      },
      { name: 'numero', label: 'Número principal', span: 1 },
      { name: 'numero_alterno', label: 'Número alterno', span: 1 },
      { name: 'letra1', label: 'Letra 1', span: 1 },
      { name: 'letra2', label: 'Letra 2', span: 1 },
      { name: 'manzana', label: 'Manzana', span: 1 },
      { name: 'lote', label: 'Lote', span: 1 },
      { name: 'sub_lote', label: 'Sub lote', span: 1 },
      { name: 'kilometro', label: 'Kilómetro', span: 1 },
      { name: 'edificacion', label: 'Edificación', kind: 'enum', span: 1 },
      { name: 'nombre_edificacion', label: 'Nombre edificación', span: 1 },
      { name: 'interior', label: 'Interior', kind: 'enum', span: 1 },
      { name: 'descripcion_interior', label: 'Descripción del interior', span: 1 },
      { name: 'piso', label: 'Piso', span: 1 },
      { name: 'ingreso', label: 'Ingreso / Puerta', span: 1 },
      { name: 'sub_zona', label: 'Sub zona', kind: 'enum', span: 1 },
      { name: 'descripcion_sub_zona', label: 'Descripción de la sub zona', span: 1 },
      { name: 'referencia', label: 'Referencia', span: 4 },
      // "buscar dirección": the point marked on the map
      { name: 'ubicacion', label: 'Ubicación', kind: 'geometry' }
    ]
  }
]

// a relacionado or a transferente with RUC is a company: a razón social instead of surnames and names (the backend
// asks the same, Personas.kt)
const esRuc = (tipoDocumento: string | null | undefined) => tipoDocumento === 'RUC'
export const conRuc = (v: FormValues) => esRuc(v.tipo_documento)
export const sinRuc = (v: FormValues) => !conRuc(v)
// a typed number, checked by its tipo as the contribuyente's
export const numeroSegunTipo = (value: string, v: FormValues) => errorDocumento(v.tipo_documento, value) ?? true

type Persona = Partial<Record<'tipo_documento' | 'apellido_paterno' | 'apellido_materno' | 'nombres' | 'razon_social', string | null>>

// how the lists name a relacionado or a transferente. one saved with RUC before the razón social still has its names
export function nombreORazonSocial(p: Persona): string {
  const nombre = [p.apellido_paterno, p.apellido_materno, p.nombres].filter(Boolean).join(' ')
  const razon = p.razon_social ?? ''
  return (esRuc(p.tipo_documento) ? razon || nombre : nombre || razon) || '—'
}

export const RELACIONADO_SECTIONS: SectionSpec[] = [
  {
    title: 'Datos de la declaración',
    fields: [
      { name: 'codigo', label: 'Código del relacionado', readOnly: true, placeholder: AUTO, span: 1 },
      { name: 'tipo_relacionado', label: 'Tipo de relacionado', kind: 'enum', required: true, span: 2 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 1 }
    ]
  },
  {
    title: 'Datos personales',
    fields: [
      { name: 'tipo_documento', label: 'Tipo de documento', kind: 'enum', required: true, span: 1 },
      { name: 'numero_documento', label: 'N° documento', span: 1, validate: numeroSegunTipo },
      { name: 'fuente_informacion', label: 'Fuente información', kind: 'enum', required: true, span: 1 },
      { name: 'razon_social', label: 'Razón social', required: true, span: 3, when: conRuc },
      { name: 'apellido_paterno', label: 'Apellido paterno', span: 1, when: sinRuc },
      { name: 'apellido_materno', label: 'Apellido materno', span: 1, when: sinRuc },
      { name: 'nombres', label: 'Nombres', required: true, span: 1, when: sinRuc },
      { name: 'fecha_inicio', label: 'Fecha de inicio', kind: 'date', span: 1 },
      { name: 'fecha_fin', label: 'Fecha de fin', kind: 'date', span: 1 },
      // greyed in the srtm: nobody types it here
      { name: 'fecha_fallecimiento', label: 'Fecha de fallecimiento', kind: 'date', readOnly: true, placeholder: 'DD/MM/AAAA', span: 1 },
      { name: 'telefono_celular', label: 'Teléfono celular', span: 1 },
      { name: 'telefono_fijo', label: 'Teléfono fijo', span: 1 },
      { name: 'anexo', label: 'Anexo', span: 1 },
      { name: 'correo', label: 'Correo electrónico', span: 3, placeholder: 'CORREO@DOMINIO.COM' }
    ]
  }
]

export const MEDIO_CONTACTO_SECTIONS: SectionSpec[] = [
  {
    title: 'Medio de contacto',
    fields: [
      { name: 'tipo', label: 'Tipo', kind: 'enum', required: true, span: 2 },
      { name: 'valor', label: 'Número o correo', required: true, span: 2 },
      { name: 'anexo', label: 'Anexo', span: 1 },
      { name: 'principal', label: 'Principal', kind: 'boolean', span: 1 },
      { name: 'observacion', label: 'Observación', span: 4 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 2 }
    ]
  }
]

export const SUSTENTO_SECTIONS: SectionSpec[] = [
  {
    title: 'Documento sustento',
    fields: [
      { name: 'documento', label: 'Documento', kind: 'enum', required: true, span: 3 },
      { name: 'numero_documento', label: 'N° documento', required: true, span: 3 },
      { name: 'tipo_presentacion', label: 'Tipo de presentación', kind: 'enum', required: true, span: 3 },
      { name: 'folios', label: 'Folios', kind: 'integer', span: 1 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 2 }
    ]
  }
]

// the fields a form sends: everything but the custom ones, which only drive hidden fields
export const dataFields = (sections: SectionSpec[]) => sections.flatMap((s) => s.fields).filter((f) => f.kind !== 'custom')

// every field of the sections, empty: the starting point of a "new" form
export function emptyOf<T>(sections: SectionSpec[], extra: Partial<T> = {}): T {
  const empty = Object.fromEntries(dataFields(sections).map((f) => [f.name, null]))
  return { ...empty, ...extra } as T
}
