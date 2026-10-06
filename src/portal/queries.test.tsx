import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useRefresh } from './queries'

// what a write makes stale: the records' queries, never the reference data read once
describe('useRefresh', () => {
  it('invalidates what reads the records, and leaves the reference data alone', async () => {
    const queryClient = new QueryClient()
    const registros = [
      ['contribuyente', 'c1', 2026],
      ['predios', '', 0],
      ['infracciones', 'acta', 'a1'],
      ['anuncios', 'ficha', 'n1']
    ]
    const referencia = [['catalogos'], ['ubigeos'], ['categorias-valor'], ['usos-predio'], ['obras-categorias']]
    for (const key of [...registros, ...referencia]) queryClient.setQueryData(key, {})
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useRefresh(), { wrapper })

    await result.current()

    for (const key of registros) expect(queryClient.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true)
    for (const key of referencia) expect(queryClient.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(false)
  })
})
