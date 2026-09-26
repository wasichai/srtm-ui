import type { Catalogos } from '../types'

// how each entity shows and edits: sections, labels and value kinds. names are the model's fields

export type FieldKind = 'text' | 'enum' | 'integer' | 'decimal' | 'money'

export interface FieldSpec {
  name: string
  label: string
  kind?: FieldKind
  required?: boolean
  wide?: boolean
}

export interface SectionSpec {
  title: string
  fields: FieldSpec[]
}

export type CatalogKey = keyof Catalogos

export const CONTRIBUYENTE_SECTIONS: SectionSpec[] = [
  {
    title: 'Identificación',
    fields: [
      { name: 'tipo_persona', label: 'Tipo de persona', kind: 'enum', required: true },
      { name: 'tipo_documento', label: 'Tipo de documento', kind: 'enum', required: true },
      { name: 'numero_documento', label: 'Número de documento', required: true }
    ]
  },
  {
    title: 'Nombre',
    fields: [
      { name: 'nombre_completo', label: 'Nombre completo', required: true, wide: true },
      { name: 'apellido_paterno', label: 'Apellido paterno' },
      { name: 'apellido_materno', label: 'Apellido materno' },
      { name: 'nombres', label: 'Nombres' },
      { name: 'razon_social', label: 'Razón social', wide: true }
    ]
  },
  {
    title: 'Domicilio fiscal',
    fields: [
      { name: 'domicilio_fiscal', label: 'Dirección', wide: true },
      { name: 'domicilio_distrito', label: 'Distrito' },
      { name: 'domicilio_provincia', label: 'Provincia' },
      { name: 'domicilio_departamento', label: 'Departamento' }
    ]
  }
]

export const PREDIO_SECTIONS: SectionSpec[] = [
  {
    title: 'Identificación',
    fields: [
      { name: 'codigo', label: 'Código', required: true },
      { name: 'condicion', label: 'Condición', kind: 'enum' },
      { name: 'sector_catastral', label: 'Sector catastral' },
      { name: 'manzana_catastral', label: 'Manzana catastral' }
    ]
  },
  {
    title: 'Ubicación',
    fields: [
      { name: 'direccion', label: 'Dirección', required: true, wide: true },
      { name: 'via', label: 'Vía', wide: true },
      { name: 'numero', label: 'Número' },
      { name: 'manzana', label: 'Manzana' },
      { name: 'lote', label: 'Lote' },
      { name: 'habilitacion_urbana', label: 'Habilitación urbana', wide: true },
      { name: 'ubicacion_area_verde', label: 'Ubicación respecto a áreas verdes', kind: 'enum', wide: true }
    ]
  }
]

export const DECLARACION_SECTIONS: SectionSpec[] = [
  {
    title: 'Declaración',
    fields: [
      { name: 'anio', label: 'Año', kind: 'integer', required: true },
      { name: 'secuencia_uso', label: 'Secuencia de uso', required: true },
      { name: 'condicion_propiedad', label: 'Condición de propiedad', kind: 'enum' },
      { name: 'porcentaje_condominio', label: '% de condominio', kind: 'decimal' }
    ]
  },
  {
    title: 'Uso y construcción',
    fields: [
      { name: 'uso', label: 'Uso', kind: 'enum' },
      { name: 'clasificacion', label: 'Clasificación', kind: 'enum', wide: true },
      { name: 'estado_construccion', label: 'Estado de construcción', kind: 'enum' },
      { name: 'numero_habitantes', label: 'Nº de habitantes', kind: 'integer' }
    ]
  },
  {
    title: 'Áreas (m²)',
    fields: [
      { name: 'area_terreno', label: 'Área de terreno', kind: 'decimal' },
      { name: 'area_construida', label: 'Área construida', kind: 'decimal' },
      { name: 'longitud_frente', label: 'Longitud de frente (m)', kind: 'decimal' }
    ]
  },
  {
    title: 'Valores',
    fields: [
      { name: 'valor_autoavaluo', label: 'Autoavalúo', kind: 'money' },
      { name: 'valor_condominio', label: 'Valor de condominio', kind: 'money' },
      { name: 'deduccion', label: 'Deducción', kind: 'money' },
      { name: 'valor_afecto', label: 'Valor afecto', kind: 'money' }
    ]
  }
]

// every field of the sections, empty: the starting point of a "new" form
export function emptyOf<T>(sections: SectionSpec[], extra: Partial<T> = {}): T {
  const empty = Object.fromEntries(sections.flatMap((s) => s.fields.map((f) => [f.name, null])))
  return { ...empty, ...extra } as T
}
