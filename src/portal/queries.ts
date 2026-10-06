import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { rentas } from './api'
import type { DeterminacionMasiva, Emision, FiltrosActas, FiltrosAnuncios, FiltrosCuis, FiltrosNotificaciones } from './types'

export function useCatalogos() {
  return useQuery({ queryKey: ['catalogos'], queryFn: rentas.catalogos, staleTime: Infinity })
}

export function useContribuyentes(q: string, page: number) {
  return useQuery({ queryKey: ['contribuyentes', q, page], queryFn: () => rentas.contribuyentes(q, page), placeholderData: keepPreviousData })
}

export function usePredios(q: string, page: number) {
  return useQuery({ queryKey: ['predios', q, page], queryFn: () => rentas.predios(q, page), placeholderData: keepPreviousData })
}

// a job still to end: the backend moves it on its own, so the list is asked again. ENSAMBLANDO is still active:
// every part is done, but the final file is not built yet
export const hayActivos = (emisiones: Emision[] | undefined) =>
  (emisiones ?? []).some((e) => e.estado === 'PENDIENTE' || e.estado === 'EN_PROCESO' || e.estado === 'ENSAMBLANDO')

// the emisiones masivas, newest first: asked every 2 s while one of them runs, not at all otherwise
export function useEmisiones() {
  return useQuery({ queryKey: ['emisiones'], queryFn: () => rentas.emisiones(), refetchInterval: (query) => (hayActivos(query.state.data) ? 2000 : false) })
}

// the reference data, read once (staleTime: Infinity): the model's catalogs, the INEI ubigeos and the valuation
// tables. no write of the portal changes them. a new one of the kind joins this list
const REFERENCIA = new Set<unknown>(['catalogos', 'ubigeos', 'categorias-valor', 'usos-predio', 'obras-categorias'])

// after any write: fichas, lists and totals all read from the same records, so all of them go stale. the reference
// data does not, and a save (which awaits this) does not wait for the whole INEI list again
export function useRefresh() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ predicate: (query) => !REFERENCIA.has(query.queryKey[0]) }), [queryClient])
}

// the determinaciones masivas de arbitrios, newest first: asked every 2 s while one of them runs
export function useDeterminaciones() {
  return useQuery({
    queryKey: ['arbitrios', 'determinaciones'],
    queryFn: () => rentas.determinaciones(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((d: DeterminacionMasiva) => d.estado === 'PENDIENTE' || d.estado === 'EN_PROCESO') ? 2000 : false
  })
}

// the infracciones administrativas' query keys: all under ['infracciones'], so an act invalidates every list, ficha
// and panel that reads them at once (queryKey: claves.infracciones)
export const claves = {
  infracciones: ['infracciones'] as const,
  cuis: ({ vigentes_a, materia, q }: FiltrosCuis) => ['infracciones', 'cuis', vigentes_a ?? null, materia ?? null, q ?? null] as const,
  notificaciones: ({ numero, q, contribuyente, desde, hasta, vencidas_a }: FiltrosNotificaciones, page: number) =>
    ['infracciones', 'notificaciones', numero ?? null, contribuyente ?? null, desde ?? null, hasta ?? null, vencidas_a ?? null, page, q ?? null] as const,
  actas: ({ numero, administrado, codigo, fase, desde, hasta }: FiltrosActas, page: number) =>
    ['infracciones', 'actas', numero ?? null, administrado ?? null, codigo ?? null, fase ?? null, desde ?? null, hasta ?? null, page] as const,
  acta: (id: string) => ['infracciones', 'acta', id] as const,
  panel: (anio: number) => ['infracciones', 'panel', anio] as const,
  plazos: (anio: number) => ['infracciones', 'plazos', anio] as const,
  vencidas: (corte: string, page: number) => ['infracciones', 'vencidas', corte, page] as const,
  notificacionesDe: (contribuyente: string, page: number) => ['infracciones', 'notificaciones-de', contribuyente, page] as const,
  infraccionesDe: (de: 'contribuyentes' | 'predios', id: string) => ['infracciones', 'de', de, id] as const,
  // the anuncios' ones, all under ['anuncios']: an act invalidates the padrón, the ficha and the fichas' tabs at once
  anuncios: ['anuncios'] as const,
  padronAnuncios: ({ contribuyente, clase, estado, vigentes_a, q }: FiltrosAnuncios, page: number) =>
    ['anuncios', 'padron', contribuyente ?? null, clase ?? null, estado ?? null, vigentes_a ?? null, q ?? null, page] as const,
  anuncio: (id: string) => ['anuncios', 'ficha', id] as const,
  tasasAnuncios: (anio: number) => ['anuncios', 'tasas', anio] as const,
  anunciosDe: (de: 'contribuyentes' | 'predios', id: string) => ['anuncios', de, id] as const
}

// the CUIS in force on a day, with each code's multa at that day's UIT (the backend's, never computed here)
export function useCuis(filtros: FiltrosCuis) {
  return useQuery({ queryKey: claves.cuis(filtros), queryFn: () => rentas.catalogoCuis(filtros), placeholderData: keepPreviousData })
}

// a page of the notificaciones previas, vencida or not at vencidas_a as the backend says (never computed here)
export function useNotificaciones(filtros: FiltrosNotificaciones, page: number) {
  return useQuery({ queryKey: claves.notificaciones(filtros, page), queryFn: () => rentas.notificaciones(filtros, page), placeholderData: keepPreviousData })
}

// a page of the expedientes, each with its fase at fase_al_dia and its estado de la deuda (the backend's)
export function useActas(filtros: FiltrosActas, page: number) {
  return useQuery({ queryKey: claves.actas(filtros, page), queryFn: () => rentas.actas(filtros, page), placeholderData: keepPreviousData })
}

// an expediente's ficha: its acta and acts in legal order, and what the legal order allows now
export function useExpediente(id: string) {
  return useQuery({ queryKey: claves.acta(id), queryFn: () => rentas.expediente(id) })
}

// a year's panel: actas, resoluciones, notificadas and what falls due this week, at al_dia (the backend's figures)
export function usePanelInfracciones(anio: number) {
  return useQuery({ queryKey: claves.panel(anio), queryFn: () => rentas.panelInfracciones(anio), placeholderData: keepPreviousData })
}

// the plazos and feriados loaded for a year, and what is missing (the backend's)
export function usePlazosInfracciones(anio: number) {
  return useQuery({ queryKey: claves.plazos(anio), queryFn: () => rentas.plazosInfracciones(anio), placeholderData: keepPreviousData })
}

// the notificaciones previas vencidas at corte that led to no acta, as the backend says (never computed here)
export function useVencidas(corte: string, page: number) {
  return useQuery({ queryKey: claves.vencidas(corte, page), queryFn: () => rentas.notificacionesVencidas(corte, page), placeholderData: keepPreviousData })
}

// a contribuyente's notificaciones previas; asked only once one is chosen
export function useNotificacionesDe(contribuyente: string | undefined, page: number) {
  return useQuery({
    queryKey: claves.notificacionesDe(contribuyente ?? '', page),
    queryFn: () => rentas.notificacionesDe(contribuyente!, page),
    enabled: Boolean(contribuyente)
  })
}

// the infracciones tab of a contribuyente's or a predio's ficha
export function useInfraccionesDe(de: 'contribuyentes' | 'predios', id: string) {
  return useQuery({ queryKey: claves.infraccionesDe(de, id), queryFn: () => rentas.infraccionesDe(de, id) })
}

// the padrón of anuncios with their estado at vigentes_a (the backend's)
export function useAnuncios(filtros: FiltrosAnuncios, page: number) {
  return useQuery({ queryKey: claves.padronAnuncios(filtros, page), queryFn: () => rentas.anuncios(filtros, page), placeholderData: keepPreviousData })
}

export function useAnuncio(id: string) {
  return useQuery({ queryKey: claves.anuncio(id), queryFn: () => rentas.anuncio(id) })
}

export function useTasasAnuncios(anio: number) {
  return useQuery({ queryKey: claves.tasasAnuncios(anio), queryFn: () => rentas.tasasAnuncios(anio), placeholderData: keepPreviousData })
}

export function useAnunciosDe(de: 'contribuyentes' | 'predios', id: string) {
  return useQuery({ queryKey: claves.anunciosDe(de, id), queryFn: () => rentas.anunciosDe(de, id) })
}
