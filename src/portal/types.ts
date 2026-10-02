import type { Geometry } from './components/geo'

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
  // 1. datos de la declaración: codigo, numero_declaracion and fecha_registro are the backend's
  codigo?: string | null
  numero_declaracion?: number | null
  fecha_registro?: string | null
  motivo?: string | null
  medio_determinacion?: string | null
  medio_presentacion?: string | null
  modificacion_oficio?: string | null
  fecha_presentacion?: string | null
  tipo_contribuyente?: string | null
  codigo_anterior?: string | null
  // 2. identificación
  fuente_informacion?: string | null
  // 3. datos personales
  fecha_nacimiento?: string | null
  fecha_fallecimiento?: string | null
  estado_civil?: string | null
  sexo?: string | null
  observacion?: string | null
}

// what RENIEC says of a DNI (GET /srtm/documentos/DNI/{numero}, through the PIDE)
export interface DatosPersona {
  tipo_documento: string
  numero_documento: string
  apellido_paterno: string | null
  apellido_materno: string | null
  nombres: string | null
  estado_civil: string | null
  direccion: string | null
  ubigeo: string | null
  fuente_informacion: string
}

// the contribuyente's lists. contribuyente is the parent's id, set by the backend
export interface Domicilio {
  id?: string
  contribuyente?: string | null
  // the backend's: 001, 002... under its contribuyente (none on a row from before)
  codigo?: string | null
  tipo_domicilio: string | null
  tipo_predio: string | null
  ubigeo: string | null
  departamento: string | null
  provincia: string | null
  distrito: string | null
  tipo_unidad_urbana: string | null
  unidad_urbana: string | null
  tipo_via: string | null
  via: string | null
  numero: string | null
  numero_alterno: string | null
  letra1: string | null
  letra2: string | null
  manzana: string | null
  lote: string | null
  sub_lote: string | null
  kilometro: string | null
  edificacion: string | null
  nombre_edificacion: string | null
  interior: string | null
  descripcion_interior: string | null
  piso: string | null
  ingreso: string | null
  sub_zona: string | null
  descripcion_sub_zona: string | null
  referencia: string | null
  descripcion?: string | null
  estado?: string | null
  // "buscar dirección": a point, geojson
  ubicacion?: Geometry | null
}

export interface Relacionado {
  id?: string
  contribuyente?: string | null
  // the backend's: 001, 002... under its contribuyente
  codigo?: string | null
  tipo_relacionado: string | null
  tipo_documento: string | null
  numero_documento: string | null
  fuente_informacion: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
  nombres: string | null
  // with RUC, instead of the names
  razon_social: string | null
  telefono_celular: string | null
  telefono_fijo: string | null
  anexo: string | null
  correo: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_fallecimiento: string | null
  estado?: string | null
}

export interface MedioContacto {
  id?: string
  contribuyente?: string | null
  // the backend's: 001, 002... under its contribuyente
  codigo?: string | null
  tipo: string | null
  valor: string | null
  anexo: string | null
  principal: boolean | null
  observacion: string | null
  estado?: string | null
}

export interface Sustento {
  id?: string
  contribuyente?: string | null
  // the backend's: 001, 002... under its contribuyente
  codigo?: string | null
  documento: string | null
  numero_documento: string | null
  tipo_presentacion: string | null
  folios: number | null
  estado?: string | null
}

export interface Ubigeo {
  codigo: string
  departamento: string
  provincia: string
  distrito: string
}

export interface Via {
  id: string
  tipo_via: string | null
  nombre: string | null
  ubigeo: string | null
}

export interface UnidadUrbana {
  id: string
  tipo_unidad_urbana: string | null
  nombre: string | null
  ubigeo: string | null
}

export interface Predio {
  id?: string
  codigo: string | null
  sector_catastral: string | null
  manzana_catastral: string | null
  tipo_predio: string | null
  direccion: string | null
  via: string | null
  numero: string | null
  manzana: string | null
  lote: string | null
  habilitacion_urbana: string | null
  ubicacion_area_verde: string | null
  // the srtm's datos de la ubicación. with tipo_via set, the backend builds direccion from them
  ubigeo?: string | null
  departamento?: string | null
  provincia?: string | null
  distrito?: string | null
  region?: string | null
  tipo_via?: string | null
  numero_alterno?: string | null
  letra1?: string | null
  letra2?: string | null
  ucv?: string | null
  sub_lote?: string | null
  kilometro?: string | null
  edificacion?: string | null
  descripcion_edificacion?: string | null
  interior?: string | null
  descripcion_interior?: string | null
  piso?: string | null
  ingreso?: string | null
  tipo_zona?: string | null
  sub_zona?: string | null
  descripcion_sub_zona?: string | null
  partida_registral?: string | null
  referencia?: string | null
  codigo_cpu?: string | null
  // the backend's, when the portal registers the predio
  numero_registro?: number | null
  // the lote's polygon, geojson (EPSG:4326)
  lote_geom?: Geometry | null
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
  // the srtm's datos del predio. numero_declaracion is the backend's
  numero_declaracion?: number | null
  motivo?: string | null
  medio_determinacion?: string | null
  medio_presentacion?: string | null
  modificacion_oficio?: string | null
  fecha_presentacion?: string | null
  tipo_adquisicion?: string | null
  fecha_adquisicion?: string | null
  documentos_sustento?: string | null
  folios?: number | null
  condicion_especial?: string | null
  condicion_tipo_documento?: string | null
  condicion_numero_documento?: string | null
  condicion_fecha_documento?: string | null
  condicion_fecha_inicio?: string | null
  condicion_fecha_fin?: string | null
  inhabitable_tipo_documento?: string | null
  inhabitable_numero_resolucion?: string | null
  inhabitable_fecha_resolucion?: string | null
  inhabitable_fecha_inicio?: string | null
  // características
  clase_uso?: string | null
  sub_clase_uso?: string | null
  area_comun_terreno?: number | null
  otros_datos?: string | null
  // VIGENTE or ANULADA (none, in the imported ones, is VIGENTE): the backend's, set by anular
  estado?: string | null
  motivo_anulacion?: string | null
  fecha_anulacion?: string | null
}

// the declaración jurada's lists. declaracion is the parent's id, set by the backend
export interface Transferente {
  id?: string
  declaracion?: string | null
  // the backend's: 001, 002... under its declaración
  codigo?: string | null
  porcentaje_transferido: number | null
  tipo_documento: string | null
  numero_documento: string | null
  fuente_informacion: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
  nombres: string | null
  // with RUC, instead of the names
  razon_social: string | null
  fecha_nacimiento: string | null
  estado_civil: string | null
  sexo: string | null
  fecha_fallecimiento: string | null
  telefono_fijo: string | null
  telefono_celular: string | null
  correo: string | null
  ubigeo: string | null
  departamento: string | null
  provincia: string | null
  distrito: string | null
  descripcion_domicilio: string | null
  estado?: string | null
}

// the letters (A-I) of the seven columns of the official unit-value table
export const COLUMNAS_CATEGORIA = ['muros_columnas', 'techos', 'pisos', 'puertas_ventanas', 'revestimientos', 'banos', 'instalaciones'] as const

export interface NivelConstruccion {
  id?: string
  declaracion?: string | null
  tipo_nivel: string | null
  numero_piso: number | null
  anio_construccion: number | null
  mes_construccion: number | null
  material: string | null
  estado_conservacion: string | null
  area_construida: number | null
  area_comun: number | null
  porcentaje_area_comun: number | null
  muros_columnas: string | null
  techos: string | null
  pisos: string | null
  puertas_ventanas: string | null
  revestimientos: string | null
  banos: string | null
  instalaciones: string | null
  estado?: string | null
}

export interface ObraComplementaria {
  id?: string
  declaracion?: string | null
  ingreso: string | null
  material: string | null
  tipo_obra: string | null
  estado_conservacion: string | null
  anio_construccion: number | null
  mes_construccion: number | null
  categoria: string | null
  valor: number | null
  numero_piso: number | null
  cantidad: number | null
  metrado: number | null
  unidad_medida: string | null
  total_metrado?: number | null
  estado?: string | null
}

export interface OtroFrente {
  id?: string
  declaracion?: string | null
  tipo_via: string | null
  via: string | null
  numero: string | null
  numero_alterno: string | null
  frontis: number | null
  lote: string | null
  cuadra: string | null
  lado: string | null
  estado?: string | null
}

export interface DeclaracionJurada {
  declaracion: Declaracion
  predio: Predio
  contribuyente: Contribuyente
  // when the declaration was last saved (the srtm's "fecha de actualización")
  actualizado?: string | null
}

// a lote of the catastro fiscal
export interface CatastroFiscal {
  id?: string
  codigo_cpu: string | null
  codigo_predio_municipal: string | null
  partida_registral: string | null
  tipo_predio: string | null
  ubigeo: string | null
  tipo_via: string | null
  via: string | null
  numero: string | null
  tipo_zona: string | null
  zona: string | null
  manzana: string | null
  lote: string | null
  kilometro: string | null
  direccion: string | null
  lote_geom?: Geometry | null
}

// the filters of "buscar predios" (page 13), over the padrón and over the catastro
export interface FiltrosPredio {
  tipo_predio?: string
  codigo?: string
  codigo_cpu?: string
  partida_registral?: string
  tipo_via?: string
  via?: string
  tipo_zona?: string
  zona?: string
  numero?: string
  manzana?: string
  lote?: string
  kilometro?: string
}

// a partida of the instructivo of obras complementarias
export interface ObraCategoria {
  id?: string
  tipo_obra: string
  numero: number
  descripcion: string
  unidad_medida: string
  material?: string | null
}

// presenting one: an existing predio (predio_id) or a new one (predio)
export interface NuevaDeclaracion {
  declaracion: Declaracion
  predio?: Predio
  predio_id?: string
}

export interface CategoriaValor {
  columna: number
  categoria: string
  letra: string
  descripcion: string
}

// one uso of the srtm's catalog (model/data/usos_predio.csv), with its clase and sub clase
export interface UsoPredio {
  codigo: string
  clase: string
  sub_clase: string
  uso: string
}

// a condómino added from a declaración ("datos de los condóminos"): another titular of its predio, year and secuencia
export interface NuevoCondomino {
  contribuyente: string
  porcentaje_condominio: number | null
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
export type CatalogKey =
  | 'contribuyente'
  | 'predio'
  | 'declaracion_predial'
  | 'domicilio'
  | 'relacionado'
  | 'medio_contacto'
  | 'sustento'
  | 'via'
  | 'unidad_urbana'
  | 'transferente'
  | 'nivel_construccion'
  | 'obra_complementaria'
  | 'otro_frente'
  | 'catastro_fiscal'
  | 'obra_categoria'
export type Catalogos = Partial<Record<CatalogKey, Record<string, string[]>>>

// the emisión masiva of a year's HR and PU (GET /srtm/emisiones): a job the backend runs in the background
export type FormatoEmision = 'PDF' | 'ZIP'
// ENSAMBLANDO: every part is done, the final file is not built yet (wasichai/srtm-ui#70)
export type EstadoEmision = 'PENDIENTE' | 'EN_PROCESO' | 'ENSAMBLANDO' | 'TERMINADA' | 'FALLIDA'

export interface Emision {
  id: string
  anio: number
  formato: FormatoEmision
  estado: EstadoEmision
  total: number
  procesados: number
  // the contribuyentes it could not emit; the rest are in the file
  errores: { contribuyente: string; mensaje: string }[]
  archivo: string | null
  // bytes of the file
  tamano: number | null
  // why a FALLIDA one failed
  mensaje: string | null
  iniciado: string | null
  terminado: string | null
}

// the arbitrios (wasichai/srtm-backend#62): what a predio or a contribuyente owes by servicio and month, as determined.
// every total comes from the backend, never summed here; every figure carries the date it was determined on
export interface ServicioArbitrio {
  id: string
  codigo: string
  nombre: string | null
  orden: number | null
  vigencia_desde: string | null
  vigencia_hasta: string | null
}

export interface PersonaArbitrio {
  id: string | null
  codigo: string | null
  nombre: string | null
}

export interface CuotaMes {
  id: string | null
  monto: number
  contribuyente: string | null
  fecha_calculo: string | null
  parametro_aplicado: string | null
}

// one servicio's twelve months: null where there is no cuota
export interface FilaServicio {
  servicio: ServicioArbitrio
  meses: (CuotaMes | null)[]
  total: number
}

export interface MatrizArbitrios {
  anio: number
  predio: { id: string | null; codigo: string | null; direccion: string | null }
  filas: FilaServicio[]
  // who the rule charges each month (the titular principal); null: no one that month
  titulares: { periodo: number; titular: PersonaArbitrio | null }[]
  totales_por_mes: number[]
  total: number
  // of the latest cuota; null while none is determined
  fecha_calculo: string | null
  // how many cuotas a determination would add now, and what it lacks to
  pendientes: number
  faltan: string[]
}

export interface ArbitriosContribuyente {
  anio: number
  contribuyente: PersonaArbitrio
  predios: MatrizArbitrios[]
  total: number
  fecha_calculo: string | null
}
