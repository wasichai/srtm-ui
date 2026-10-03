import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { rentas } from './api'
import type { DeterminacionMasiva, Emision, FiltrosAnuncios, FiltrosCuis } from './types'

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

// after any write: fichas, lists and totals all read from the same records, so all of them go stale
export function useRefresh() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'catalogos' }), [queryClient])
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
