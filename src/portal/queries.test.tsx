import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { basesDeArbitrio, dimensionesDeArbitrio, useRefresh } from './queries'
import type { ParametroTributario } from './types'

// what the DJ reads from the year's arbitrios rows: their texto trimmed, as srtm-backend reads it (Servicios.baseLeida,
// Servicios.dimensiones), so a row typed with spaces asks for the same as the backend charges by

const fila = (tipo: string, texto: string | null): ParametroTributario => ({
  id: null,
  tipo,
  clave: 'LIMPIEZA',
  texto,
  vigencia_desde: '2026-01-01',
  vigencia_hasta: null,
  valor_numerico: null,
  norma: null,
  fuente: null,
  transcribio: null,
  verifico: null
})

describe('basesDeArbitrio', () => {
  it('reads each BASE_ARBITRIO texto trimmed, and none from a blank one', () => {
    expect(basesDeArbitrio([fila('BASE_ARBITRIO', ' FRONTIS_ML '), fila('BASE_ARBITRIO', '   '), fila('TASA_ARBITRIO', 'AREA_CONSTRUIDA_M2')])).toEqual(
      new Set(['FRONTIS_ML'])
    )
  })

  it('reads none without rows', () => {
    expect(basesDeArbitrio(undefined)).toEqual(new Set())
  })
})

describe('dimensionesDeArbitrio', () => {
  it('reads each DIMENSIONES_ARBITRIO texto split by commas, each one trimmed', () => {
    expect(dimensionesDeArbitrio([fila('DIMENSIONES_ARBITRIO', ' ZONA , INFLUENCIA ,'), fila('DIMENSIONES_ARBITRIO', '  ')])).toEqual(
      new Set(['ZONA', 'INFLUENCIA'])
    )
  })
})

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
