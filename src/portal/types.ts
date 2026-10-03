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
  // what each contribuyente got: HR, PU and, when asked for, HLA (none in a job from before the HLA: HR and PU)
  documentos?: DocumentoEmision[]
}

// the documents of each contribuyente of an emisión masiva (srtm-backend#65); by default the HR and the PUs
export type DocumentoEmision = 'HR' | 'PU' | 'HLA'

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

// a cuota as the backend writes it (POST …/arbitrios answers the ones it wrote)
export interface CuotaArbitrio {
  id: string
  predio: string
  contribuyente: string
  servicio: string
  anio: number
  periodo: number
  monto: number
  parametro_aplicado: string
  fecha_calculo: string
  observacion: string
}

// a row of parametro_tributario: a normative value in force from vigencia_desde to vigencia_hasta (open when null)
export interface ParametroTributario {
  id: string | null
  tipo: string
  clave: string | null
  vigencia_desde: string | null
  vigencia_hasta: string | null
  valor_numerico: number | null
  texto: string | null
  norma: string | null
  fuente: string | null
  transcribio: string | null
  verifico: string | null
}

export interface OrdenanzaArbitrio {
  id: string | null
  anio: number
  numero: string | null
  fecha_publicacion: string | null
  acuerdo_ratificacion: string | null
  fecha_ratificacion: string | null
  municipalidad_ratificante: string | null
}

// GET /srtm/arbitrios/parametros: the year's ordinance, servicios and the ordinance's rows, and what the year lacks
export interface ParametrosArbitrios {
  anio: number
  ordenanza: OrdenanzaArbitrio | null
  servicios: ServicioArbitrio[]
  parametros: ParametroTributario[]
  faltan: string[]
}

// the determinación masiva of a year's arbitrios (GET /srtm/arbitrios/determinaciones): a job the backend runs in the
// background, by lotes of predios. it ends without a file: never ENSAMBLANDO
export interface DeterminacionMasiva {
  id: string
  anio: number
  estado: EstadoEmision
  // predios
  total: number
  procesados: number
  // cuotas written
  generadas: number
  // the predios it could not determine, by code, and why
  errores: { predio: string; mensaje: string }[]
  mensaje: string | null
  observacion: string | null
  iniciado: string | null
  terminado: string | null
}

// the infracciones administrativas (SPEC §7, Multas): every amount, fase and due date is the backend's, never computed
// here; every figure travels with its date. dates are ISO, money a number with two decimals
export type FamiliaInfraccion = 'ADMINISTRATIVA'
export type GradoReincidencia = 'PRIMERA' | 'SEGUNDA' | 'TERCERA_O_MAS'
export type TipoRecurso = 'DESCARGO' | 'RECONSIDERACION' | 'APELACION' | 'NULIDAD'
export type TipoResolucionGerencia = 'ADMINISTRATIVA' | 'RECURSO'
export type SentidoFallo = 'FUNDADO' | 'FUNDADO_EN_PARTE' | 'INFUNDADO' | 'IMPROCEDENTE'
export type EfectoMulta = 'SE_MANTIENE' | 'SE_DEJA_SIN_EFECTO' | 'SE_REDUCE'
export type ModalidadNotificacion = 'PERSONAL' | 'CEDULON' | 'PUBLICACION' | 'CORREO'
export type ResultadoNotificacion = 'NOTIFICADO' | 'NO_UBICADO' | 'RECHAZADO'
// where an acta's procedure stands on a day (fase_al_dia): null once ANULADA or DEJADA_SIN_EFECTO
export type FaseProcedimiento = 'PREVENTIVA' | 'CONSTATADA' | 'SANCIONADA'
// what is left of the multa: never PAGADA nor COACTIVA, srtm has no collection
export type EstadoDeuda = 'PENDIENTE' | 'ANULADA' | 'DEJADA_SIN_EFECTO'

// a version of a CUIS code (codigo_infraccion): in force from vigencia_desde to vigencia_hasta (open when null). the
// porcentajes are alícuotas of the UIT: the first time, the second and the third or more
export interface CodigoInfraccion {
  id: string
  familia: FamiliaInfraccion
  codigo: string
  descripcion: string
  materia: string | null
  porcentaje_uit: number
  porcentaje_uit_segunda: number | null
  porcentaje_uit_tercera: number | null
  medida_complementaria: string | null
  base_legal: string
  vigencia_desde: string
  vigencia_hasta: string | null
  observacion: string
  clave: string
  clave_vigente: string | null
}

// a code of the catalog with its multas at the UIT of vigentes_a: null without UIT, or without the grade's %
export interface Cuis extends CodigoInfraccion {
  multa: number | null
  multa_segunda: number | null
  multa_tercera: number | null
}

// the UIT a figure was computed with: the parametro_tributario row read
export interface UitAplicada {
  valor: number
  anio: number
  parametro_id: string
}

export interface FiltrosCuis {
  vigentes_a?: string
  materia?: string
  // the code or the description
  q?: string
}

// GET /srtm/infracciones/cuis
export interface CatalogoCuis {
  vigentes_a: string
  uit: UitAplicada | null
  // what keeps a multa from being computed ("UIT 2026")
  faltan: string[]
  codigos: Cuis[]
}

// POST /srtm/infracciones/cuis: familia ADMINISTRATIVA when not given
export interface NuevaVersionCuis {
  familia?: FamiliaInfraccion
  codigo: string
  descripcion: string
  materia?: string | null
  porcentaje_uit: number
  porcentaje_uit_segunda?: number | null
  porcentaje_uit_tercera?: number | null
  medida_complementaria?: string | null
  base_legal: string
  vigencia_desde: string
  observacion: string
}

// its 201: the new version, and the one it closed (its vigencia_hasta set) if one was in force
export interface VersionCuisCreada extends CodigoInfraccion {
  cerrada: CodigoInfraccion | null
}

// a notificación previa (notificacion_administrativa) as written
export interface NotificacionAdministrativa {
  id: string
  numero: string
  fecha: string
  direccion: string
  motivo: string
  plazo_dias: number | null
  observacion: string
  contribuyente: string | null
  predio: string | null
}

// a row of GET /srtm/infracciones/notificaciones (and por-contribuyente): with what the backend derives at vencidas_a
export interface NotificacionPrevia extends NotificacionAdministrativa {
  vencimiento: string | null
  vencida: boolean
  vencidas_a: string
  subsanada: { fecha: string } | null
  acta: { id: string; numero: string } | null
  contribuyente_nombre: string | null
}

export interface FiltrosNotificaciones {
  // the número exactly
  numero?: string
  // part of the número, whatever its case (the picker of the nueva acta)
  q?: string
  contribuyente?: string
  desde?: string
  hasta?: string
  vencidas_a?: string
}

// a row of GET /srtm/infracciones/notificaciones/vencidas: not subsanada, without acta, overdue at corte
export interface NotificacionVencida extends NotificacionAdministrativa {
  vencimiento: string
  corte: string
  contribuyente_nombre?: string | null
}

export interface NuevaNotificacion {
  numero: string
  fecha: string
  contribuyente?: string | null
  predio?: string | null
  direccion: string
  motivo: string
  plazo_dias?: number | null
  observacion: string
}

// POST …/notificaciones/{id}/subsanacion: fecha today when not given
export interface NuevaSubsanacion {
  fecha?: string
  observacion: string
}

export interface SubsanacionNotificacion {
  id: string
  fecha: string
  observacion: string
  clave: string
  notificacion: string
}

// the multa of an acta, frozen when it was written: the UIT and the % copied from the parámetro and the CUIS
export interface Desglose {
  base_imponible: number
  porcentaje_infraccion: number
  importe_infraccion: number
  porcentaje_a_cobrar: number
  importe_a_pagar: number
  importe_con_beneficio: number | null
  fecha_calculo?: string
}

// an acta (papeleta) as written
export interface Papeleta {
  id: string
  familia: FamiliaInfraccion
  numero: string
  clave: string
  fecha_infraccion: string
  hora_infraccion: string | null
  lugar: string
  expediente: string | null
  inspector: string | null
  descripcion_hecho: string | null
  reincidencia: GradoReincidencia
  medida_complementaria: string | null
  base_imponible: number
  porcentaje_infraccion: number
  importe_infraccion: number
  porcentaje_a_cobrar: number
  importe_a_pagar: number
  importe_con_beneficio: number | null
  fecha_calculo: string
  observacion: string
  codigo_infraccion: string
  uit: string
  obligado: string
  contribuyente: string | null
  predio: string | null
  notificacion_previa: string | null
}

// POST /srtm/infracciones/actas: codigo is the CUIS code's text
export interface NuevaActa {
  numero: string
  fecha_infraccion: string
  hora_infraccion?: string | null
  lugar: string
  codigo: string
  reincidencia: GradoReincidencia
  obligado: string
  contribuyente?: string | null
  predio?: string | null
  notificacion_previa?: string | null
  expediente?: string | null
  inspector?: string | null
  descripcion_hecho?: string | null
  observacion: string
}

// its 201: the acta, its stable reference (PAPELETA-<id>) and its multa
export interface ActaCreada extends Papeleta {
  referencia: string
  desglose: Desglose
}

// a row of GET /srtm/infracciones/actas (and of a contribuyente's or predio's infracciones)
export interface Procedimiento {
  id: string
  numero: string
  fecha_infraccion: string
  administrado: string | null
  documento: string | null
  codigo: string
  descripcion_infraccion: string | null
  porcentaje_infraccion: number
  importe_a_pagar: number
  fecha_calculo: string
  medida_complementaria: string | null
  fase: FaseProcedimiento | null
  fase_al_dia: string
  estado_de_la_deuda: EstadoDeuda
}

export interface FiltrosActas {
  numero?: string
  // documento or nombre (contains)
  administrado?: string
  codigo?: string
  fase?: FaseProcedimiento
  desde?: string
  hasta?: string
}

export interface AnulacionPapeleta {
  id: string
  fecha: string
  motivo: string
  observacion: string
  clave: string
  papeleta: string
}

export interface NuevaAnulacion {
  motivo: string
  fecha?: string
  observacion: string
}

export interface DescargoPapeleta {
  id: string
  numero_expediente: string
  tipo_recurso: TipoRecurso
  fecha: string
  presentado_hasta: string
  en_plazo: boolean
  // the plazo copied: "5 DIAS_HABILES"
  plazo_texto: string
  sustento: string
  observacion: string
  papeleta: string
  plazo: string
}

export interface NuevoDescargo {
  numero_expediente: string
  tipo_recurso: TipoRecurso
  fecha: string
  sustento: string
  observacion: string
}

// a resolución: RIS-AAAA-NNNNNN (ADMINISTRATIVA, one per acta) or RGR-AAAA-NNNNNN (RECURSO, resolving a descargo)
export interface ResolucionGerencia {
  id: string
  tipo: TipoResolucionGerencia
  anio: number
  correlativo: number
  numero: string
  fecha: string
  sentido: SentidoFallo | null
  efecto: EfectoMulta | null
  sancion_accesoria: string | null
  sustento: string
  plazo_texto: string
  clave_ris: string | null
  clave_descargo: string | null
  observacion: string
  papeleta: string
  descargo: string | null
  plazo: string
}

export interface NuevaResolucion {
  tipo: TipoResolucionGerencia
  descargo?: string | null
  sentido?: SentidoFallo | null
  efecto?: EfectoMulta | null
  fecha?: string
  sustento: string
  sancion_accesoria?: string | null
  observacion: string
}

export interface NotificacionResolucion {
  id: string
  intento: number
  clave: string
  fecha_diligencia: string
  modalidad: ModalidadNotificacion
  resultado: ResultadoNotificacion
  notificador: string
  direccion: string
  receptor: string | null
  documento_receptor: string | null
  vinculo: string | null
  acuse: string | null
  // only when it takes effect (NOTIFICADO or RECHAZADO)
  exigible_desde: string | null
  plazo_texto: string | null
  observacion: string
  resolucion: string
  plazo: string | null
}

// without direccion, the obligado's domicilio fiscal in force at the diligencia
export interface NuevaNotificacionResolucion {
  fecha_diligencia?: string
  modalidad: ModalidadNotificacion
  resultado: ResultadoNotificacion
  notificador: string
  direccion?: string | null
  receptor?: string | null
  documento_receptor?: string | null
  vinculo?: string | null
  acuse?: string | null
  observacion: string
}

// one act of an expediente, in legal order: notificación previa, acta, descargos, resoluciones, notificaciones, anulación
export interface ActoExpediente {
  orden: number
  acto: string
  fecha: string
  documento: string | null
  id: string
  detalle: string | null
}

// whether the legal order and the account allow an action now, and why not
export interface AccionPermitida {
  permitida: boolean
  motivo: string | null
}

// a resolución in the ficha: its notificaciones, and whether one can be added now (not once the acta is anulada or
// dejada sin efecto: nothing is left to notify)
export type ResolucionDelExpediente = ResolucionGerencia & {
  notificaciones: NotificacionResolucion[]
  acciones?: { notificacion: AccionPermitida }
}

// who and what the acta is about, as the backend reads them (the acta keeps only ids): the obligado with its
// domicilio fiscal (null when it has none), the contribuyente and the predio when the acta names them
export interface PartesExpediente {
  obligado: { id: string; nombre: string; documento: string | null; domicilio_fiscal: string | null }
  contribuyente: { id: string; nombre: string; documento: string | null } | null
  predio: { id: string; codigo: string | null; direccion: string | null } | null
}

// GET /srtm/infracciones/actas/{id}
export interface ExpedienteInfraccion {
  acta: Papeleta
  referencia: string
  // the version used on the day of the infracción
  codigo_infraccion: CodigoInfraccion
  notificacion_previa: NotificacionAdministrativa | null
  actos: ActoExpediente[]
  descargos: DescargoPapeleta[]
  resoluciones: ResolucionDelExpediente[]
  anulacion: AnulacionPapeleta | null
  fase: FaseProcedimiento | null
  fase_al_dia: string
  estado_de_la_deuda: EstadoDeuda
  acciones: { descargo: AccionPermitida; resolucion: AccionPermitida; anulacion: AccionPermitida }
  // absent from an older backend: the ficha then links the ids alone
  partes?: PartesExpediente
}

// GET /srtm/infracciones/panel
export interface PanelInfracciones {
  anio: number
  al_dia: string
  actas: number
  resoluciones: number
  notificadas: number
  vencen_esta_semana: number
  semana: { desde: string; hasta: string }
  // there is no collection in srtm: always null, and nota says so
  coactiva: null
  nota: string
}

// GET /srtm/contribuyentes/{id}/infracciones and /srtm/predios/{id}/infracciones
export interface InfraccionesDe {
  al_dia: string
  actas: Procedimiento[]
}

// a PLAZO in force for a year (DESCARGO_PAPELETA, RG_RECURSO): the parametro_tributario row read
export interface PlazoCargado {
  clave: string
  dias: number
  // DIAS_HABILES
  unidad: string
  // "5 DIAS_HABILES"
  texto: string
  vigencia_desde: string
  vigencia_hasta: string | null
  parametro_id: string
}

// GET /srtm/infracciones/plazos?anio: the PLAZO in force on 1 January (or on al_dia in the current year) and the
// year's FERIADOS; what is not loaded is named in faltan ("PLAZO RG_RECURSO 2027", "FERIADOS 2027")
export interface PlazosInfracciones {
  anio: number
  al_dia: string
  plazos: PlazoCargado[]
  feriados: { fechas: string[]; parametro_id: string } | null
  faltan: string[]
}
