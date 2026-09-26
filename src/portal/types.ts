// what /api/srtm answers (srtm-backend, package srtm.rentas). keys are the model's field names

export interface Contribuyente {
  id?: string
  tipo_persona: string | null
  tipo_documento: string | null
  numero_documento: string | null
  nombre_completo: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
  nombres: string | null
  razon_social: string | null
  domicilio_fiscal: string | null
  domicilio_distrito: string | null
  domicilio_provincia: string | null
  domicilio_departamento: string | null
}

export interface Predio {
  id?: string
  codigo: string | null
  sector_catastral: string | null
  manzana_catastral: string | null
  condicion: string | null
  direccion: string | null
  via: string | null
  numero: string | null
  manzana: string | null
  lote: string | null
  habilitacion_urbana: string | null
  ubicacion_area_verde: string | null
}

export interface Declaracion {
  id?: string
  contribuyente: string | null
  predio: string | null
  anio: number | null
  secuencia_uso: string | null
  condicion_propiedad: string | null
  porcentaje_condominio: number | null
  uso: string | null
  clasificacion: string | null
  estado_construccion: string | null
  area_terreno: number | null
  area_construida: number | null
  longitud_frente: number | null
  numero_habitantes: number | null
  valor_autoavaluo: number | null
  valor_condominio: number | null
  deduccion: number | null
  valor_afecto: number | null
}

export interface DeclaracionDetalle {
  declaracion: Declaracion
  predio: Predio | null
  contribuyente: Contribuyente | null
}

export interface Totales {
  declaraciones: number
  autoavaluo: number
  valor_afecto: number
}

export interface ContribuyenteFicha {
  contribuyente: Contribuyente
  anio: number
  predios: number
  totales: Totales
}

export interface PredioFicha {
  predio: Predio
  anio: number
  titulares: number
  totales: Totales
}

export interface Resumen {
  anio: number
  contribuyentes: number
  predios: number
  declaraciones: number
}

export interface Pagina<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// enum options by object, then field
export type Catalogos = Record<'contribuyente' | 'predio' | 'declaracion_predial', Record<string, string[]>>
