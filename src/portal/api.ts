import { createApiClient } from '@wasichai/core'
import type {
  Catalogos,
  CategoriaValor,
  Contribuyente,
  ContribuyenteFicha,
  Declaracion,
  DeclaracionDetalle,
  DeclaracionJurada,
  Domicilio,
  MedioContacto,
  NivelConstruccion,
  NuevaDeclaracion,
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

  domicilios: hijos<Domicilio>('contribuyentes', 'domicilios'),
  relacionados: hijos<Relacionado>('contribuyentes', 'relacionados'),
  mediosContacto: hijos<MedioContacto>('contribuyentes', 'medios-contacto'),
  sustentos: hijos<Sustento>('contribuyentes', 'sustentos'),

  // the declaración jurada predial
  presentarDeclaracion: (contribuyente: string, body: NuevaDeclaracion) =>
    send<DeclaracionJurada>('POST', `/srtm/contribuyentes/${contribuyente}/declaraciones-juradas`, body),
  declaracionJurada: (id: string) => get<DeclaracionJurada>(`/srtm/declaraciones/${id}`),
  transferentes: hijos<Transferente>('declaraciones', 'transferentes'),
  niveles: hijos<NivelConstruccion>('declaraciones', 'niveles'),
  obras: hijos<ObraComplementaria>('declaraciones', 'obras'),
  frentes: hijos<OtroFrente>('declaraciones', 'frentes'),
  categoriasValor: () => get<CategoriaValor[]>('/srtm/categorias-valor'),

  predios: (q: string, page: number, size = PAGE_SIZE) => get<Pagina<Predio>>(`/srtm/predios${query({ q, page, size })}`),
  predio: (id: string, anio: number) => get<PredioFicha>(`/srtm/predios/${id}${query({ anio })}`),
  declaracionesDePredio: (id: string, anio?: number) => get<DeclaracionDetalle[]>(`/srtm/predios/${id}/declaraciones${query({ anio })}`),
  crearPredio: (body: Predio) => send<Predio>('POST', '/srtm/predios', body),
  actualizarPredio: (id: string, body: Predio) => send<Predio>('PUT', `/srtm/predios/${id}`, body),

  crearDeclaracion: (body: Declaracion) => send<Declaracion>('POST', '/srtm/declaraciones', body),
  actualizarDeclaracion: (id: string, body: Declaracion) => send<Declaracion>('PUT', `/srtm/declaraciones/${id}`, body)
}
