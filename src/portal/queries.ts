import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { rentas } from './api'

export function useCatalogos() {
  return useQuery({ queryKey: ['catalogos'], queryFn: rentas.catalogos, staleTime: Infinity })
}

export function useContribuyentes(q: string, page: number) {
  return useQuery({ queryKey: ['contribuyentes', q, page], queryFn: () => rentas.contribuyentes(q, page), placeholderData: keepPreviousData })
}

export function usePredios(q: string, page: number) {
  return useQuery({ queryKey: ['predios', q, page], queryFn: () => rentas.predios(q, page), placeholderData: keepPreviousData })
}

// after any write: fichas, lists and totals all read from the same records, so all of them go stale
export function useRefresh() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'catalogos' }), [queryClient])
}
