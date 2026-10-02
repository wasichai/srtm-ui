import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { rentas } from './api'
import type { DeterminacionMasiva, Emision } from './types'

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
