import { rentas } from '../api'
import { BuscarPrediosButton } from './BuscarPrediosButton'
import { CatastroMapa } from './CatastroMapa'
import { CategoriasFields, COLUMNAS } from './CategoriasFields'
import { DireccionPreview } from './DireccionPreview'
import { ObraCategoriaField } from './ObraCategoriaField'
import { conRuc, numeroSegunTipo, sinRuc, type SectionSpec } from './specs'
import { UbigeoFields } from './UbigeoFields'
import type { Elegido } from './ubicacion'

// the srtm's declaración jurada predial, tab by tab (Presentacion2_.pdf, pages 11 to 21)

const AUTO = '(AUTOGENERADO)'
const nombres = (items: { nombre: string | null }[]) => items.map((i) => i.nombre ?? '').filter(Boolean)

// what an acquisition is proven with; several may apply, kept as one text
export const DOCUMENTOS_ADQUISICION = [
  'MINUTA',
  'ESCRITURA PUBLICA',
  'CONTRATO PRIVADO',
  'TITULO DE PROPIEDAD',
  'CONSTANCIA DE POSESION',
  'DECLARATORIA DE HEREDEROS',
  'RESOLUCION JUDICIAL',
  'OTROS'
]

// datos del predio: the declaration itself
export const DJ_DATOS_SECTIONS: SectionSpec[] = [
  {
    title: 'Datos de predio',
    fields: [
      // the predio's, shown here as in the srtm; tipo de predio is saved on the predio
      { name: 'codigo_predio', label: 'Código de predio', readOnly: true, placeholder: AUTO, span: 2 },
      { name: 'numero_registro', label: 'Número de registro de predio', kind: 'integer', readOnly: true, placeholder: AUTO, span: 2 },
      { name: 'condicion', label: 'Tipo de predio', kind: 'enum', required: true, span: 2 },
      { name: 'numero_declaracion', label: 'Número de declaración jurada', kind: 'integer', readOnly: true, placeholder: AUTO, span: 2 },
      { name: 'medio_determinacion', label: 'Medio de determinación', kind: 'enum', readOnly: true, placeholder: 'DECLARACION JURADA', span: 2 },
      { name: 'medio_presentacion', label: 'Medio de presentación', kind: 'enum', required: true, span: 2 },
      { name: 'modificacion_oficio', label: 'Modificación de oficio', kind: 'enum', readOnly: true, span: 2 },
      { name: 'motivo', label: 'Motivo de modificación', kind: 'enum', readOnly: true, placeholder: 'INSCRIPCION', span: 2 },
      { name: 'fecha_presentacion', label: 'Fecha de presentación', kind: 'date', required: true, span: 2 },
      { name: 'anio', label: 'Año', kind: 'integer', required: true, span: 1 },
      { name: 'secuencia_uso', label: 'Secuencia de uso', span: 1 }
    ]
  },
  {
    title: 'Datos de la adquisición',
    fields: [
      { name: 'tipo_adquisicion', label: 'Tipo de adquisición', kind: 'enum', required: true, span: 2 },
      { name: 'fecha_adquisicion', label: 'Fecha de adquisición', kind: 'date', required: true, span: 2 },
      { name: 'fecha_actualizacion', label: 'Fecha de actualización', kind: 'date', readOnly: true, placeholder: AUTO, span: 2 },
      { name: 'condicion_propiedad', label: 'Tipo de propiedad', kind: 'enum', required: true, span: 2 },
      { name: 'porcentaje_condominio', label: '% de propiedad', kind: 'decimal', required: true, span: 1 },
      { name: 'folios', label: 'Folios', kind: 'integer', required: true, span: 1 },
      { name: 'documentos_sustento', label: 'Documentos de sustento', kind: 'multi', choices: DOCUMENTOS_ADQUISICION, required: true, span: 4 }
    ]
  },
  {
    title: 'Condición del predio',
    fields: [
      { name: 'condicion_especial', label: 'Condición del predio', kind: 'enum', span: 2 },
      ...[
        { name: 'condicion_tipo_documento', label: 'Tipo documento de sustento', kind: 'enum' as const, span: 2 as const },
        { name: 'condicion_numero_documento', label: 'Número de documento de sustento', span: 2 as const },
        { name: 'condicion_fecha_documento', label: 'Fecha del documento de sustento', kind: 'date' as const, span: 2 as const },
        { name: 'condicion_fecha_inicio', label: 'Fecha de inicio de condición', kind: 'date' as const, span: 2 as const },
        { name: 'condicion_fecha_fin', label: 'Fecha fin de condición', kind: 'date' as const, span: 2 as const }
      ].map((f) => ({ ...f, enabledWhen: (v: Record<string, string>) => Boolean(v.condicion_especial) }))
    ]
  },
  {
    title: 'Predio inhabitable',
    fields: [
      { name: 'inhabitable_tipo_documento', label: 'Tipo documento', kind: 'enum', span: 2 },
      ...[
        { name: 'inhabitable_numero_resolucion', label: 'Número de resolución', span: 2 as const },
        { name: 'inhabitable_fecha_resolucion', label: 'Fecha de resolución', kind: 'date' as const, span: 1 as const },
        { name: 'inhabitable_fecha_inicio', label: 'Fecha de inicio de resolución', kind: 'date' as const, span: 1 as const }
      ].map((f) => ({ ...f, enabledWhen: (v: Record<string, string>) => Boolean(v.inhabitable_tipo_documento) }))
    ]
  },
  {
    title: 'Otros datos',
    fields: [{ name: 'otros_datos', label: 'Otros datos', kind: 'longtext', span: 6, placeholder: 'OTROS DATOS' }]
  }
]

// fields of the datos-del-predio form that belong to the predio, not to the declaration
export const DATOS_DEL_PREDIO = ['codigo_predio', 'numero_registro', 'condicion', 'fecha_actualizacion']

// datos de la ubicación: the predio's. onPredio: what "buscar predios" does with a predio of the padrón (by default
// its ubicación is copied into the form)
export function ubicacionSections(onPredio?: (elegido: Elegido) => boolean): SectionSpec[] {
  return [
    {
      title: 'Identificación del predio',
      fields: [
        { name: 'numero_registro', label: 'Número de registro de predio', kind: 'integer', readOnly: true, placeholder: AUTO, span: 2 },
        { name: 'condicion', label: 'Tipo de predio', kind: 'enum', required: true, span: 2 },
        { name: 'sector_catastral', label: 'Sector', required: true, span: 1 },
        { name: 'manzana_catastral', label: 'Manzana catastral', required: true, span: 1 }
      ]
    },
    {
      title: 'Datos de la ubicación del predio',
      action: (form) => <BuscarPrediosButton form={form} onPredio={onPredio} />,
      fields: [
        { name: 'ubigeo_cascada', label: 'Ubigeo', kind: 'custom', span: 6, render: (form) => <UbigeoFields form={form} /> },
        { name: 'ubigeo', label: 'Ubigeo', kind: 'hidden' },
        { name: 'departamento', label: 'Departamento', kind: 'hidden', required: true },
        { name: 'provincia', label: 'Provincia', kind: 'hidden', required: true },
        { name: 'distrito', label: 'Distrito', kind: 'hidden', required: true },
        { name: 'region', label: 'Región', kind: 'enum', required: true, span: 1 },
        { name: 'tipo_via', label: 'Tipo de vía', kind: 'enum', required: true, span: 1 },
        {
          name: 'via',
          label: 'Descripción de la vía',
          kind: 'suggest',
          required: true,
          span: 2,
          suggest: async (q, v) => nombres((await rentas.vias(q, v.tipo_via, v.ubigeo)).content)
        },
        { name: 'numero', label: 'Número principal', span: 1 },
        { name: 'numero_alterno', label: 'Número alterno', span: 1 },
        { name: 'letra1', label: 'Letra 1', span: 1 },
        { name: 'letra2', label: 'Letra 2', span: 1 },
        { name: 'manzana', label: 'Manzana', span: 1 },
        { name: 'ucv', label: 'UCV', span: 1 },
        { name: 'lote', label: 'Lote', span: 1 },
        { name: 'sub_lote', label: 'Sub lote', span: 1 },
        { name: 'kilometro', label: 'Kilómetro', span: 2 },
        { name: 'edificacion', label: 'Edificación', kind: 'enum', span: 1 },
        { name: 'descripcion_edificacion', label: 'Descrip. de la edificación', span: 1 },
        { name: 'interior', label: 'Interior', kind: 'enum', span: 1 },
        { name: 'descripcion_interior', label: 'Descripción del interior', span: 1 },
        { name: 'piso', label: 'Piso', span: 1 },
        { name: 'ingreso', label: 'Ingreso / Puerta', span: 1 },
        { name: 'tipo_zona', label: 'Zona', kind: 'enum', span: 1 },
        {
          name: 'habilitacion_urbana',
          label: 'Descripción de la zona',
          kind: 'suggest',
          required: true,
          span: 2,
          suggest: async (q, v) => nombres((await rentas.unidadesUrbanas(q, v.tipo_zona, v.ubigeo)).content)
        },
        { name: 'sub_zona', label: 'Sub zona', kind: 'enum', span: 1 },
        { name: 'descripcion_sub_zona', label: 'Descripción de la sub zona', span: 1 },
        { name: 'partida_registral', label: 'Partida registral', span: 1 },
        { name: 'ubicacion_area_verde', label: 'Ubicación respecto a áreas verdes', kind: 'enum', span: 3 },
        { name: 'referencia', label: 'Referencia', span: 3 },
        // built by the backend from the fields above (a predio of the padrón keeps its text until it has a tipo de vía):
        // what is stored, then what saving will write
        { name: 'direccion', label: 'Dirección actual', readOnly: true, span: 6, when: (v) => Boolean(v.direccion) },
        { name: 'direccion_vista', label: 'Vista previa de la dirección', kind: 'custom', span: 6, render: (form) => <DireccionPreview form={form} /> }
      ]
    },
    {
      title: 'Predio de catastro fiscal',
      fields: [
        { name: 'codigo_cpu', label: 'Código CPU', span: 2 },
        { name: 'codigo', label: 'Código de predio municipal', readOnly: true, placeholder: AUTO, span: 2 },
        { name: 'mapa', label: 'Mapa', kind: 'custom', span: 6, render: (form) => <CatastroMapa form={form} /> },
        { name: 'lote_geom', label: 'Lote', kind: 'geometry' }
      ]
    }
  ]
}

export const UBICACION_SECTIONS: SectionSpec[] = ubicacionSections()

// características: the declaration's uso and areas; niveles and obras are lists of their own
export const CARACTERISTICAS_SECTIONS: SectionSpec[] = [
  {
    title: 'Características de predio',
    fields: [
      { name: 'clase_uso', label: 'Clase de uso', kind: 'enum', required: true, span: 2 },
      { name: 'sub_clase_uso', label: 'Sub clase de uso', kind: 'enum', required: true, span: 2 },
      { name: 'uso', label: 'Uso del predio', kind: 'enum', required: true, span: 2 },
      { name: 'clasificacion', label: 'Clasificación', kind: 'enum', span: 3 },
      { name: 'estado_construccion', label: 'Estado de construcción', kind: 'enum', span: 3 },
      { name: 'area_terreno', label: 'Área del terreno (m2)', kind: 'decimal', required: true, span: 2 },
      { name: 'area_comun_terreno', label: 'Área común del terreno (m2)', kind: 'decimal', span: 2 },
      { name: 'longitud_frente', label: 'Frontis (m)', kind: 'decimal', span: 1 },
      { name: 'numero_habitantes', label: 'Cant. de habitantes / Aforo', kind: 'integer', span: 1 }
    ]
  }
]

export const TRANSFERENTE_SECTIONS: SectionSpec[] = [
  {
    title: 'Datos de la declaración',
    fields: [
      { name: 'codigo', label: 'Código del transferente', readOnly: true, placeholder: AUTO, span: 1 },
      { name: 'porcentaje_transferido', label: '% de propiedad transferido', kind: 'decimal', required: true, span: 2 }
    ]
  },
  {
    title: 'Datos personales',
    fields: [
      { name: 'tipo_documento', label: 'Tipo de documento', kind: 'enum', required: true, span: 1 },
      { name: 'numero_documento', label: 'N° documento', required: true, span: 1, validate: numeroSegunTipo },
      { name: 'fuente_informacion', label: 'Fuente información', kind: 'enum', required: true, span: 1 },
      { name: 'razon_social', label: 'Razón social', required: true, span: 3, when: conRuc },
      { name: 'apellido_paterno', label: 'Apellido paterno', required: true, span: 1, when: sinRuc },
      { name: 'apellido_materno', label: 'Apellido materno', span: 1, when: sinRuc },
      { name: 'nombres', label: 'Nombres', required: true, span: 1, when: sinRuc },
      { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', kind: 'date', span: 1 },
      { name: 'estado_civil', label: 'Estado civil', kind: 'enum', span: 1 },
      { name: 'sexo', label: 'Sexo', kind: 'enum', span: 1 },
      // greyed in the srtm: nobody types it here
      { name: 'fecha_fallecimiento', label: 'Fecha de fallecimiento', kind: 'date', readOnly: true, placeholder: 'DD/MM/AAAA', span: 1 },
      { name: 'telefono_fijo', label: 'Teléfono fijo', span: 1 },
      { name: 'telefono_celular', label: 'Teléfono celular', span: 1 },
      { name: 'correo', label: 'Correo electrónico', span: 2, placeholder: 'CORREO@DOMINIO.COM' },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 1 }
    ]
  },
  {
    title: 'Domicilio',
    fields: [
      { name: 'ubigeo_cascada', label: 'Ubigeo', kind: 'custom', span: 6, render: (form) => <UbigeoFields form={form} /> },
      { name: 'ubigeo', label: 'Ubigeo', kind: 'hidden' },
      { name: 'departamento', label: 'Departamento', kind: 'hidden', required: true },
      { name: 'provincia', label: 'Provincia', kind: 'hidden', required: true },
      { name: 'distrito', label: 'Distrito', kind: 'hidden', required: true },
      { name: 'descripcion_domicilio', label: 'Descripción domicilio', required: true, span: 6 }
    ]
  }
]

export const NIVEL_SECTIONS: SectionSpec[] = [
  {
    title: 'Datos del nivel',
    fields: [
      { name: 'tipo_nivel', label: 'Tipo de nivel', kind: 'enum', required: true, span: 2 },
      { name: 'numero_piso', label: 'Número de piso', kind: 'integer', required: true, span: 1 },
      { name: 'anio_construccion', label: 'Año construcción', kind: 'integer', required: true, span: 1 },
      { name: 'mes_construccion', label: 'Mes construcción', kind: 'month', required: true, span: 2 },
      { name: 'material', label: 'Material predominante', kind: 'enum', required: true, span: 2 },
      { name: 'estado_conservacion', label: 'Estado de conservación', kind: 'enum', required: true, span: 2 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 2 },
      { name: 'area_construida', label: 'Área construida (m2)', kind: 'decimal', required: true, span: 2 },
      { name: 'area_comun', label: 'Área común construida (m2)', kind: 'decimal', span: 2 },
      { name: 'porcentaje_area_comun', label: '% área común construida', kind: 'decimal', span: 2 }
    ]
  },
  {
    title: 'Datos de la categoría',
    fields: [
      { name: 'categorias', label: 'Categorías', kind: 'custom', span: 6, render: (form) => <CategoriasFields form={form} /> },
      ...COLUMNAS.map((c) => ({ name: c.field, label: c.label, kind: 'hidden' as const, required: c.required }))
    ]
  }
]

export const OBRA_SECTIONS: SectionSpec[] = [
  {
    title: 'Obra complementaria',
    fields: [
      { name: 'ingreso', label: 'Ingreso', kind: 'enum', required: true, span: 2 },
      { name: 'material', label: 'Material predominante', kind: 'enum', required: true, span: 2 },
      { name: 'tipo_obra', label: 'Tipo de obra', kind: 'enum', required: true, span: 2 },
      { name: 'estado_conservacion', label: 'Estado de conservación', kind: 'enum', required: true, span: 2 },
      { name: 'anio_construccion', label: 'Año construcción', kind: 'integer', required: true, span: 2 },
      { name: 'mes_construccion', label: 'Mes construcción', kind: 'month', required: true, span: 2 },
      {
        name: 'categoria_catalogo',
        label: 'Categoría',
        kind: 'custom',
        span: 6,
        render: (form) => (form.getValues('ingreso') === 'CON VALORIZACION' ? null : <ObraCategoriaField form={form} />)
      },
      { name: 'categoria', label: 'Categoría', kind: 'hidden', required: true, when: (v) => v.ingreso !== 'CON VALORIZACION' },
      { name: 'valor', label: 'Valor (S/)', kind: 'money', required: true, span: 2, when: (v) => v.ingreso === 'CON VALORIZACION' },
      { name: 'numero_piso', label: 'Número de piso', kind: 'integer', required: true, span: 1 },
      { name: 'cantidad', label: 'Cantidad', kind: 'decimal', required: true, span: 1 },
      { name: 'metrado', label: 'Metrado', kind: 'decimal', required: true, span: 1 },
      { name: 'unidad_medida', label: 'Unidad de medida', kind: 'enum', span: 1 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 2 }
    ]
  }
]

export const FRENTE_SECTIONS: SectionSpec[] = [
  {
    title: 'Otro frente',
    fields: [
      { name: 'tipo_via', label: 'Tipo vía', kind: 'enum', required: true, span: 2 },
      {
        name: 'via',
        label: 'Descripción de la vía',
        kind: 'suggest',
        required: true,
        span: 3,
        suggest: async (q, v) => nombres((await rentas.vias(q, v.tipo_via)).content)
      },
      { name: 'numero', label: 'N° principal', span: 1 },
      { name: 'numero_alterno', label: 'N° alterno', span: 1 },
      { name: 'frontis', label: 'Frontis (m)', kind: 'decimal', required: true, span: 1 },
      { name: 'lote', label: 'Lote', span: 1 },
      { name: 'cuadra', label: 'Cuadra', span: 1 },
      { name: 'lado', label: 'Lado', kind: 'enum', span: 1 },
      { name: 'estado', label: 'Estado', kind: 'enum', span: 1 }
    ]
  }
]
