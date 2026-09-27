import { ApiError, createApiClient, getActiveApiClient } from '@wasichai/core'
import type { Bbox, FeatureCollection } from './components/geo'
import type {
  CatastroFiscal,
  Catalogos,
  CategoriaValor,
  Contribuyente,
  ContribuyenteFicha,
  DatosPersona,
  Declaracion,
  DeclaracionDetalle,
  DeclaracionJurada,
  FiltrosPredio,
  Domicilio,
  Emision,
  FormatoEmision,
  MedioContacto,
  NivelConstruccion,
  NuevaDeclaracion,
  NuevoCondomino,
  ObraCategoria,
  ObraComplementaria,
  OtroFrente,
  Pagina,
  Predio,
  PredioFicha,
  Relacionado,
  Resumen,
  Sustento,
  Transferente,
  Ubigeo,
  UnidadUrbana,
  UsoPredio,
  Via
} from './types'

// same base url and storage prefix as the admin: the token one signs in with is the other's too
export const client = createApiClient({ baseUrl: '/api', storagePrefix: 'srtm' })

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

// a file the backend sends (a pdf, a zip), with the name its Content-Disposition gives. a refusal comes as problem+json:
// an ApiError that carries its fields too (title, detail, errors and whatever else the route adds)
async function blob(path: string): Promise<{ blob: Blob; filename: string }> {
  const active = getActiveApiClient()
  const token = active.getToken()
  const response = await fetch(`${active.baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) {
    const text = await response.text()
    let problem: Record<string, unknown> = {}
    try {
      problem = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      // not problem+json: the status says it all
    }
    const message = String(problem.detail ?? problem.title ?? response.statusText)
    throw Object.assign(new ApiError(response.status, message, (problem.errors as ApiError['violations']) ?? []), problem, { status: response.status })
  }
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? path.split('/').pop() ?? 'archivo'
  return { blob: await response.blob(), filename: decodeURIComponent(filename) }
}

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

  // the emisión masiva: one at a time (409 while another is PENDIENTE or EN_PROCESO), the newest first
  emisiones: (anio?: number) => get<Emision[]>(`/srtm/emisiones${query({ anio })}`),
  emitir: (anio: number, formato: FormatoEmision) => send<Emision>('POST', '/srtm/emisiones', { anio, formato })
}
