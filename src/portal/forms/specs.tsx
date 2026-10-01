import type { FormValues, SectionSpec } from '../../kit/forms/spec'
import { rentas } from '../api'
import { auto } from './auto'
import { nombres, ubigeoCampos } from './bloques'
import { errorDocumento, pideNumero, SIN_DOCUMENTO } from './documento'
import { RENIEC } from './reniec'

// how each entity shows and edits (the kit's forms/spec.ts): sections, labels and value kinds. names are the model's
// fields. the srtm screens lay a section out on six columns; span says how many a field takes

// a persona natural (or sociedad conyugal) has surnames and names; everyone else a razón social.
// imported contribuyentes have no tipo_contribuyente yet: their tipo_persona decides (a SUCESION has a razón social).
// a new one without either shows the names, as the srtm's empty form
export const esPersonaNatural = (v: FormValues) =>
  v.tipo_contribuyente ? ['PERSONA NATURAL', 'SOCIEDAD CONYUGAL'].includes(v.tipo_contribuyente) : !v.tipo_persona || v.tipo_persona === 'NATURAL'

export const CONTRIBUYENTE_SECTIONS: SectionSpec[] = [
  {
    id: 'datos-de-la-declaracion',
    title: 'Datos de la declaración',
    number: 1,
    fields: [
      { name: 'codigo', label: 'Código de contribuyente', readOnly: true, placeholder: auto(), span: 1 },
      { name: 'numero_declaracion', label: 'Número de declaración', kind: 'integer', readOnly: true, placeholder: auto(), span: 1 },
      { name: 'fecha_registro', label: 'Fecha del registro', kind: 'date', readOnly: true, placeholder: auto({ date: true }), span: 1 },
      { name: 'motivo', label: 'Motivo', kind: 'enum', readOnly: true, placeholder: 'INSCRIPCION', span: 1 },
      { name: 'medio_determinacion', label: 'Medio de determinación', kind: 'enum', readOnly: true, placeholder: 'DECLARACIÓN JURADA', span: 1 },
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
    id: 'datos-de-identificacion',
    title: 'Datos de identificación',
    number: 2,
    fields: [
      { name: 'tipo_documento', label: 'Tipo de documento', kind: 'enum', required: true, span: 1, ...RENIEC.tipo },
      // greyed until a tipo is chosen, and for SIN DOCUMENTO: none for a new one or one switched to it, the padrón's
      // number for one that already was (the backend keeps it: the importer knows it by it). a DNI asks RENIEC
      {
        name: 'numero_documento',
        label: 'N° documento',
        required: true,
        span: 2,
        enabledWhen: (v) => pideNumero(v.tipo_documento),
        greyedValue: (v, stored) => (v.tipo_documento === SIN_DOCUMENTO && stored.tipo_documento === SIN_DOCUMENTO ? stored.numero_documento : ''),
        validate: (value, v) => errorDocumento(v.tipo_documento, value) ?? true,
        ...RENIEC.numero
      },
      { name: 'fuente_informacion', label: 'Fuente información', kind: 'enum', required: true, span: 1, ...RENIEC.fuente }
    ]
  },
  {
    id: 'datos-personales',
    title: 'Datos personales',
    number: 3,
    fields: [
      { name: 'apellido_paterno', label: 'Apellido paterno', span: 1, when: esPersonaNatural, ...RENIEC.nombre },
      { name: 'apellido_materno', label: 'Apellido materno', span: 1, when: esPersonaNatural, ...RENIEC.nombre },
      { name: 'nombres', label: 'Nombres', required: true, span: 1, when: esPersonaNatural, ...RENIEC.nombre },
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

export const DOMICILIO_SECTIONS: SectionSpec[] = [
  {
    id: 'datos-del-domicilio',
    title: 'Datos del domicilio',
    fields: [
      { name: 'tipo_domicilio', label: 'Tipo de domicilio', kind: 'enum', required: true, span: 1 },
      { name: 'tipo_predio', label: 'Tipo de predio', kind: 'enum', required: true, span: 1 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 1 },
      ...ubigeoCampos(),
      { name: 'tipo_unidad_urbana', label: 'Tipo unidad urbana', kind: 'enum', span: 1 },
      {
        name: 'unidad_urbana',
        label: 'Descripción unidad urbana',
        kind: 'suggest',
        // an address may have no unidad urbana, or no street ("Mz/Lt, AA.HH."): each is asked only with its tipo
        required: (v) => !!v.tipo_unidad_urbana,
        span: 2,
        suggest: {
          fetch: async (q, v) => nombres((await rentas.unidadesUrbanas(q, v.tipo_unidad_urbana, v.ubigeo)).content),
          dependsOn: ['tipo_unidad_urbana', 'ubigeo']
        }
      },
      { name: 'tipo_via', label: 'Tipo de vía', kind: 'enum', span: 1 },
      {
        name: 'via',
        label: 'Descripción de la vía',
        kind: 'suggest',
        required: (v) => !!v.tipo_via,
        span: 2,
        suggest: { fetch: async (q, v) => nombres((await rentas.vias(q, v.tipo_via, v.ubigeo)).content), dependsOn: ['tipo_via', 'ubigeo'] }
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
    id: 'datos-de-la-declaracion',
    title: 'Datos de la declaración',
    fields: [
      { name: 'codigo', label: 'Código del relacionado', readOnly: true, placeholder: auto(), span: 1 },
      { name: 'tipo_relacionado', label: 'Tipo de relacionado', kind: 'enum', required: true, span: 2 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 1 }
    ]
  },
  {
    id: 'datos-personales',
    title: 'Datos personales',
    fields: [
      { name: 'tipo_documento', label: 'Tipo de documento', kind: 'enum', required: true, span: 1, ...RENIEC.tipo },
      { name: 'numero_documento', label: 'N° documento', span: 1, validate: numeroSegunTipo, ...RENIEC.numero },
      { name: 'fuente_informacion', label: 'Fuente información', kind: 'enum', required: true, span: 1, ...RENIEC.fuente },
      { name: 'razon_social', label: 'Razón social', required: true, span: 3, when: conRuc },
      { name: 'apellido_paterno', label: 'Apellido paterno', span: 1, when: sinRuc, ...RENIEC.nombre },
      { name: 'apellido_materno', label: 'Apellido materno', span: 1, when: sinRuc, ...RENIEC.nombre },
      { name: 'nombres', label: 'Nombres', required: true, span: 1, when: sinRuc, ...RENIEC.nombre },
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
    id: 'medio-de-contacto',
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
    id: 'documento-sustento',
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
