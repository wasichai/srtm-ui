import type { CategoriaBrecha, Confianza, DecisionBrecha } from '../../types'

// the contract of GET /api/srtm/visor (srtm-backend's visor, wasichai/srtm-ui#154): the same fields as catastro's
// /api/catastro/brechas, in snake_case, over srtm's own corrida de brecha. srtm only reads: catastro keeps the decisions

export const CATEGORIAS_VISOR: readonly CategoriaBrecha[] = ['OMISO', 'SIN_CATASTRO', 'SIN_VALOR', 'SUBVALUADO', 'SOBREVALUADO', 'COINCIDE', 'SIN_LEVANTAR']
export const CONFIANZAS_VISOR: readonly Confianza[] = ['CONFIABLE', 'DUDOSO', 'SIN_LEVANTAR']
export const ESTADOS_VISOR: readonly DecisionBrecha[] = ['PENDIENTE', 'A_INSPECCIONAR', 'INSPECCIONADO', 'A_FISCALIZAR', 'DESCARTADO']

// how srtm matched a piso: in both, in only one, or it could not tell (brecha_nivel.estado)
export type EstadoNivel = 'PAR' | 'SOLO_RENTAS' | 'SOLO_CATASTRO' | 'AMBIGUO'

// a DECIMAL may come as a number or as its text
export type Decimal = number | string | null

export interface CuentaVisor<K extends string | null> {
  clave: K
  fichas: number
  delta_impuesto?: Decimal
}

// GET /panel: the corrida read and its figures, over every row of it
export interface PanelVisor {
  corrida: { id: string; anio?: number; terminado?: string | null; version_catastro?: string | null }
  kpis: {
    fichas: number
    delta_impuesto: Decimal
    delta_impuesto_confiable: Decimal
    omisos_estimado: Decimal
    supera_5_uit: number
    // null when catastro could not be read: srtm does not know the decisions then
    pendientes: number | null
    con_geometria: number
  }
  por_categoria: CuentaVisor<CategoriaBrecha>[]
  por_confianza: CuentaVisor<Confianza | null>[]
  por_estado: CuentaVisor<DecisionBrecha>[]
  // the 10 sectores with the largest Δ impuesto
  top_sectores: { sector: string | null; fichas: number; delta_impuesto: Decimal }[]
}

// a row of GET /predios: a brecha_predio of the corrida with catastro's decision on it. predio and declaracion are
// srtm's ids (null for an omiso, which has neither)
export interface FilaVisor {
  id: string
  predio: string | null
  declaracion?: string | null
  codigo_predio: string | null
  codigo_catastro: string | null
  sector: string | null
  manzana: string | null
  lote: string | null
  uso: string | null
  categoria: CategoriaBrecha
  confianza: Confianza | null
  confianza_motivo?: string | null
  impuesto_declarado: Decimal
  impuesto_catastro: Decimal
  delta_impuesto: Decimal
  delta_arbitrios: Decimal
  estimado?: boolean | null
  motivo?: string | null
  // null: the year has no UIT
  supera_5_uit: boolean | null
  // null: no decision read (catastro not reachable)
  estado: DecisionBrecha | null
  con_geometria?: boolean
}

export interface PaginaVisor<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// a piso of a row (brecha_nivel): the declared area, the surveyed one and delta = catastro − rentas when it has both
export interface NivelVisor {
  piso: number | null
  area_rentas: Decimal
  area_catastro: Decimal
  estado: EstadoNivel
  delta: Decimal
}

// maplibre drops null properties: they arrive as undefined
export interface LoteVisorProps {
  codigo?: string | null
  codigo_catastro?: string | null
  categoria: CategoriaBrecha
  confianza: Confianza | null
  delta_impuesto: number | null
  estado: DecisionBrecha | null
  supera_5_uit: boolean | null
}

// GET /lotes/{codigo}/predios (srtm-backend#265): the predios of a lote with their DJ, their contribuyente and their row
// of the corrida. predio, declaracion and contribuyente are srtm's ids; contribuyente_nombre is null when the user may
// not read contribuyentes
export interface PredioDeLote {
  id: string
  predio: string | null
  codigo_predio: string | null
  declaracion: string | null
  contribuyente: string | null
  contribuyente_nombre: string | null
  categoria: CategoriaBrecha
  confianza: Confianza | null
  delta_impuesto: Decimal
  estado: DecisionBrecha | null
}

export interface LotesVisor {
  type: 'FeatureCollection'
  features: { type: 'Feature'; id?: string | number; geometry: { type: string; coordinates: unknown }; properties: LoteVisorProps }[]
}

export interface Filtros {
  categoria: CategoriaBrecha[]
  confianza: Confianza[]
  estado: DecisionBrecha[]
  sector: string
  // '' = both
  supera_5_uit: '' | 'true' | 'false'
  min_delta: string
}

export type Orden = 'delta_desc' | 'delta_asc' | 'codigo'

// GET /capas: the WMS layers catastro publishes for the organization
export interface CapaVisor {
  layerName: string
  label: string
}

// a WMS layer turned on, with its opacity (0 to 1)
export interface CapaWmsActiva {
  layerName: string
  opacity: number
}

// GET /vias?anio: catastro's /api/catastro/vias/aranceles as is, one feature per tramo_via (EPSG:4326)
export type Lado = 'AMBOS' | 'IZQUIERDO' | 'DERECHO'
export type Asignacion = 'NOMBRE_UNICO' | 'CERCANIA' | 'LOTES' | 'SIN_ARANCEL'

export interface TramoProps {
  cod_via_eje: string | null
  tip_via: string | null
  nom_via: string | null
  cuadra: string | null
  lado: Lado
  id_aranc: string | null
  asignacion: Asignacion
  anio: number
  valor_m2: number | null
}

export interface TramosCollection {
  type: 'FeatureCollection'
  features: { type: 'Feature'; id?: string | number; geometry: { type: string; coordinates: unknown }; properties: TramoProps }[]
}
