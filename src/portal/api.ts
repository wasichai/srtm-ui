import { ApiError, createApiClient, type ApiClient, type FieldViolation } from '@wasichai/core'
import type { Bbox, FeatureCollection } from './components/geo'
import type {
  ArbitriosContribuyente,
  CatastroFiscal,
  Catalogos,
  CategoriaValor,
  Contribuyente,
  ContribuyenteFicha,
  CuotaArbitrio,
  DatosPersona,
  Declaracion,
  DeclaracionDetalle,
  DeclaracionJurada,
  DeterminacionMasiva,
  FiltrosPredio,
  Domicilio,
  Emision,
  FormatoEmision,
  MatrizArbitrios,
  MedioContacto,
  NivelConstruccion,
  NuevaDeclaracion,
  NuevoCondomino,
  ObraCategoria,
  ObraComplementaria,
  OtroFrente,
  Pagina,
  ParametrosArbitrios,
  Predio,
  PredioFicha,
  Relacionado,
  Resumen,
  ServicioArbitrio,
  Sustento,
  Transferente,
  Ubigeo,
  UnidadUrbana,
  UsoPredio,
  Via
} from './types'

// same base url and storage prefix as the admin: the token one signs in with is the other's too
const base = createApiClient({ baseUrl: '/api', storagePrefix: 'srtm' })

// core's AuthProvider hands the client what to do on a 401 (sign out); kept here too, so rentas.blob, which fetches
// on its own, signs out the same way
let onUnauthorized: (() => void) | null = null
export const client: ApiClient = {
  ...base,
  setOnUnauthorized: (handler) => {
    onUnauthorized = handler
    base.setOnUnauthorized(handler)
  }
}

// a titular of a predio as the PU's 409 lists them, for picking one
export interface TitularPu {
  id: string
  nombre: string
  documento: string | null
}

// srtm-backend's problem+json, with what the PDFs add: the titulares to pick from (409 of the PU) and the year's
// parámetros that are missing (422 of the HR)
export class RentasError extends ApiError {
  constructor(
    status: number,
    message: string,
    violations: FieldViolation[] = [],
    readonly titulares: TitularPu[] = [],
    readonly faltan: string[] = []
  ) {
    super(status, message, violations)
  }
}

// the file name of a Content-Disposition: filename*=UTF-8''… (RFC 5987) before filename="…"
function nombreDeArchivo(disposition: string | null): string | null {
  if (!disposition) return null
  const extendido = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(disposition)
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1].trim())
    } catch {
      return extendido[1].trim()
    }
  }
  const simple = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition)
  return simple ? (simple[1] ?? simple[2]).trim() : null
}

// a file (the PU, the HR, a mass emission's): client.request only reads JSON, so it is fetched here, with the same
// token, the same sign-out on a 401 and the same problem+json errors
async function blob(path: string): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers()
  const token = client.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${client.baseUrl}${path}`, { headers })
  if (!response.ok) {
    if (response.status === 401) {
      client.setToken(null)
      onUnauthorized?.()
    }
    const text = await response.text().catch(() => '')
    let problem: Record<string, unknown> = {}
    try {
      problem = text ? ((JSON.parse(text) as Record<string, unknown> | null) ?? {}) : {}
    } catch {
      problem = {}
    }
    const texto = (valor: unknown) => (typeof valor === 'string' && valor ? valor : null)
    const lista = <T>(valor: unknown) => (Array.isArray(valor) ? (valor as T[]) : [])
    throw new RentasError(
      response.status,
      texto(problem.detail) ?? texto(problem.title) ?? (response.statusText || `Error ${response.status}`),
      lista<FieldViolation>(problem.errors),
      lista<TitularPu>(problem.titulares),
      lista<unknown>(problem.faltan).map(String)
    )
  }
  const archivo = nombreDeArchivo(response.headers.get('Content-Disposition')) ?? path.split('?')[0].split('/').filter(Boolean).join('-')
  return { blob: await response.blob(), filename: archivo }
}

const get = <T>(path: string) => client.request<T>(path)
const send = <T>(method: 'POST' | 'PUT', path: string, body: unknown) => client.request<T>(path, { method, body: JSON.stringify(body) })
const remove = (path: string) => client.request<void>(path, { method: 'DELETE' })

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const PAGE_SIZE = 20

// a list that hangs from a record (a contribuyente, a declaración): listed and added under it, changed and removed
// by its own id
export interface HijosApi<T> {
  listar: (parent: string) => Promise<T[]>
  agregar: (parent: string, body: T) => Promise<T>
  actualizar: (id: string, body: T) => Promise<T>
  borrar: (id: string) => Promise<void>
}

function hijos<T>(parent: 'contribuyentes' | 'declaraciones', segment: string): HijosApi<T> {
  return {
    listar: (id) => get<T[]>(`/srtm/${parent}/${id}/${segment}`),
    agregar: (id, body) => send<T>('POST', `/srtm/${parent}/${id}/${segment}`, body),
    actualizar: (id, body) => send<T>('PUT', `/srtm/${segment}/${id}`, body),
    borrar: (id) => remove(`/srtm/${segment}/${id}`)
  }
}

export const rentas = {
  blob,
  resumen: () => get<Resumen>('/srtm/resumen'),
  catalogos: () => get<Catalogos>('/srtm/catalogos'),
  ubigeos: () => get<Ubigeo[]>('/srtm/ubigeos'),
  vias: (q: string, tipo?: string | null, ubigeo?: string | null) => get<Pagina<Via>>(`/srtm/vias${query({ q, tipo, ubigeo })}`),
  unidadesUrbanas: (q: string, tipo?: string | null, ubigeo?: string | null) =>
    get<Pagina<UnidadUrbana>>(`/srtm/unidades-urbanas${query({ q, tipo, ubigeo })}`),

  contribuyentes: (q: string, page: number, size = PAGE_SIZE) => get<Pagina<Contribuyente>>(`/srtm/contribuyentes${query({ q, page, size })}`),
  contribuyente: (id: string, anio: number) => get<ContribuyenteFicha>(`/srtm/contribuyentes/${id}${query({ anio })}`),
  declaracionesDeContribuyente: (id: string, anio?: number) => get<DeclaracionDetalle[]>(`/srtm/contribuyentes/${id}/declaraciones${query({ anio })}`),
  inscribirContribuyente: (body: Contribuyente) => send<Contribuyente>('POST', '/srtm/contribuyentes', body),
  actualizarContribuyente: (id: string, body: Contribuyente) => send<Contribuyente>('PUT', `/srtm/contribuyentes/${id}`, body),
  // RENIEC's names for a DNI (PIDE RENIEC): a 404 when it has none, or there is no convenio
  consultarDocumento: (tipo: string, numero: string) => get<DatosPersona>(`/srtm/documentos/${encodeURIComponent(tipo)}/${encodeURIComponent(numero)}`),
  // refused (409, with why) while it has declaraciones
  borrarContribuyente: (id: string) => remove(`/srtm/contribuyentes/${id}`),

  domicilios: hijos<Domicilio>('contribuyentes', 'domicilios'),
  relacionados: hijos<Relacionado>('contribuyentes', 'relacionados'),
  mediosContacto: hijos<MedioContacto>('contribuyentes', 'medios-contacto'),
  sustentos: hijos<Sustento>('contribuyentes', 'sustentos'),

  // the declaración jurada predial
  presentarDeclaracion: (contribuyente: string, body: NuevaDeclaracion) =>
    send<DeclaracionJurada>('POST', `/srtm/contribuyentes/${contribuyente}/declaraciones-juradas`, body),
  declaracionJurada: (id: string) => get<DeclaracionJurada>(`/srtm/declaraciones/${id}`),
  // the descargo: the declaración stays, read-only, out of totales and condominio
  anularDeclaracion: (id: string, motivo_anulacion: string | null) => send<Declaracion>('POST', `/srtm/declaraciones/${id}/anular`, { motivo_anulacion }),
  // another titular of the declaración's predio, year and secuencia: the backend recomputes everyone's %
  agregarCondomino: (id: string, body: NuevoCondomino) => send<Declaracion>('POST', `/srtm/declaraciones/${id}/condominos`, body),
  transferentes: hijos<Transferente>('declaraciones', 'transferentes'),
  niveles: hijos<NivelConstruccion>('declaraciones', 'niveles'),
  obras: hijos<ObraComplementaria>('declaraciones', 'obras'),
  frentes: hijos<OtroFrente>('declaraciones', 'frentes'),
  categoriasValor: () => get<CategoriaValor[]>('/srtm/categorias-valor'),
  obrasCategorias: () => get<ObraCategoria[]>('/srtm/obras-categorias'),
  usosPredio: () => get<UsoPredio[]>('/srtm/usos-predio'),

  // "buscar predios" (page 13): the padrón (tributario) and the catastro fiscal, same filters
  buscarPredios: (filtros: FiltrosPredio, page: number, size: number) => get<Pagina<Predio>>(`/srtm/predios/buscar${query({ ...filtros, page, size })}`),
  buscarCatastro: (filtros: FiltrosPredio, page: number, size: number) => get<Pagina<CatastroFiscal>>(`/srtm/catastro${query({ ...filtros, page, size })}`),
  lote: (id: string) => get<CatastroFiscal>(`/srtm/catastro/${id}`),
  crearLote: (body: CatastroFiscal) => send<CatastroFiscal>('POST', '/srtm/catastro', body),
  actualizarLote: (id: string, body: CatastroFiscal) => send<CatastroFiscal>('PUT', `/srtm/catastro/${id}`, body),

  // the lotes on the map: wasichai-gis's features of an object, in the visible area
  lotes: (objeto: 'predio' | 'catastro_fiscal', bbox: Bbox) =>
    get<FeatureCollection>(`/gis/objects/${objeto}/features${query({ bbox: bbox.map((n) => n.toFixed(6)).join(','), geometry: 'lote_geom', limit: 500 })}`),

  predios: (q: string, page: number, size = PAGE_SIZE) => get<Pagina<Predio>>(`/srtm/predios${query({ q, page, size })}`),
  predio: (id: string, anio: number) => get<PredioFicha>(`/srtm/predios/${id}${query({ anio })}`),
  declaracionesDePredio: (id: string, anio?: number) => get<DeclaracionDetalle[]>(`/srtm/predios/${id}/declaraciones${query({ anio })}`),
  crearPredio: (body: Predio) => send<Predio>('POST', '/srtm/predios', body),
  actualizarPredio: (id: string, body: Predio) => send<Predio>('PUT', `/srtm/predios/${id}`, body),
  // refused (409, with why) while it has declaraciones
  borrarPredio: (id: string) => remove(`/srtm/predios/${id}`),

  actualizarDeclaracion: (id: string, body: Declaracion) => send<Declaracion>('PUT', `/srtm/declaraciones/${id}`, body),

  // the arbitrios of a year: a predio's servicio by month, and a contribuyente's by predio (only its own cuotas)
  arbitriosDePredio: (id: string, anio: number) => get<MatrizArbitrios>(`/srtm/predios/${id}/arbitrios${query({ anio })}`),
  arbitriosDeContribuyente: (id: string, anio: number) => get<ArbitriosContribuyente>(`/srtm/contribuyentes/${id}/arbitrios${query({ anio })}`),
  // a page of the year's cuotas, by servicio when given (422 names a filter it cannot serve)
  cuotasArbitrio: (anio: number, servicio: string | null, page: number, size = PAGE_SIZE) =>
    get<Pagina<CuotaArbitrio>>(`/srtm/arbitrios${query({ anio, servicio, page, size })}`),
  serviciosArbitrio: (anio: number) => get<ServicioArbitrio[]>(`/srtm/arbitrios/servicios${query({ anio })}`),
  parametrosArbitrio: (anio: number) => get<ParametrosArbitrios>(`/srtm/arbitrios/parametros${query({ anio })}`),
  // the cuotas still to determine, written: [] when none was pending. 422 with what is missing, 400 for the observación,
  // 403 without CREATE on cuota_arbitrio
  determinarArbitriosDePredio: (id: string, anio: number, observacion: string) =>
    send<CuotaArbitrio[]>('POST', `/srtm/predios/${id}/arbitrios`, { anio, observacion }),
  // every predio of its declarations of the year: all of them or none
  determinarArbitriosDeContribuyente: (id: string, anio: number, observacion: string) =>
    send<CuotaArbitrio[]>('POST', `/srtm/contribuyentes/${id}/arbitrios`, { anio, observacion }),

  // the determinación masiva of a year's arbitrios: one per year at a time (409), the newest first. 403 without the
  // permissions its lotes use; 422 with what the year lacks; 400 for the observación
  determinaciones: (anio?: number) => get<DeterminacionMasiva[]>(`/srtm/arbitrios/determinaciones${query({ anio })}`),
  determinarMasiva: (anio: number, observacion: string) => send<DeterminacionMasiva>('POST', '/srtm/arbitrios/determinaciones', { anio, observacion }),
  borrarDeterminacion: (id: string) => remove(`/srtm/arbitrios/determinaciones/${id}`),

  // the emisión masiva: one at a time (409 while another is PENDIENTE or EN_PROCESO), the newest first
  emisiones: (anio?: number) => get<Emision[]>(`/srtm/emisiones${query({ anio })}`),
  // 403 without UPDATE on emision_masiva
  emitir: (anio: number, formato: FormatoEmision) => send<Emision>('POST', '/srtm/emisiones', { anio, formato }),
  // the record and its file; refused (409) while it runs
  borrarEmision: (id: string) => remove(`/srtm/emisiones/${id}`)
}
