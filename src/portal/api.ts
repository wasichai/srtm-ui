import { createApiClient } from '@wasichai/core'
import type { Catalogos, Contribuyente, ContribuyenteFicha, Declaracion, DeclaracionDetalle, Pagina, Predio, PredioFicha, Resumen } from './types'

// same base url and storage prefix as the admin: the token one signs in with is the other's too
export const client = createApiClient({ baseUrl: '/api', storagePrefix: 'srtm' })

const get = <T>(path: string) => client.request<T>(path)
const send = <T>(method: 'POST' | 'PUT', path: string, body: unknown) => client.request<T>(path, { method, body: JSON.stringify(body) })

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const PAGE_SIZE = 20

export const rentas = {
  resumen: () => get<Resumen>('/srtm/resumen'),
  catalogos: () => get<Catalogos>('/srtm/catalogos'),

  contribuyentes: (q: string, page: number, size = PAGE_SIZE) => get<Pagina<Contribuyente>>(`/srtm/contribuyentes${query({ q, page, size })}`),
  contribuyente: (id: string, anio: number) => get<ContribuyenteFicha>(`/srtm/contribuyentes/${id}${query({ anio })}`),
  declaracionesDeContribuyente: (id: string, anio?: number) => get<DeclaracionDetalle[]>(`/srtm/contribuyentes/${id}/declaraciones${query({ anio })}`),
  crearContribuyente: (body: Contribuyente) => send<Contribuyente>('POST', '/srtm/contribuyentes', body),
  actualizarContribuyente: (id: string, body: Contribuyente) => send<Contribuyente>('PUT', `/srtm/contribuyentes/${id}`, body),

  predios: (q: string, page: number, size = PAGE_SIZE) => get<Pagina<Predio>>(`/srtm/predios${query({ q, page, size })}`),
  predio: (id: string, anio: number) => get<PredioFicha>(`/srtm/predios/${id}${query({ anio })}`),
  declaracionesDePredio: (id: string, anio?: number) => get<DeclaracionDetalle[]>(`/srtm/predios/${id}/declaraciones${query({ anio })}`),
  crearPredio: (body: Predio) => send<Predio>('POST', '/srtm/predios', body),
  actualizarPredio: (id: string, body: Predio) => send<Predio>('PUT', `/srtm/predios/${id}`, body),

  crearDeclaracion: (body: Declaracion) => send<Declaracion>('POST', '/srtm/declaraciones', body),
  actualizarDeclaracion: (id: string, body: Declaracion) => send<Declaracion>('PUT', `/srtm/declaraciones/${id}`, body)
}
