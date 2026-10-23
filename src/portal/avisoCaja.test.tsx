import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { rentas } from './api'
import { AvisosDeArbitrios, DURACION_AVISO } from './components/AvisosDeArbitrios'
import { cambioCaja, ENCABEZADO_CAJA, escucharCaja, leerResumenCaja, mensajesDeCaja, publicarCaja } from './components/avisoCaja'
import type { ResumenCaja } from './types'

// el encabezado Srtm-Caja (wasichai/srtm-backend#164): leído, dicho y publicado por api.ts. cifras FICTICIAS

let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const ceros: ResumenCaja = { encoladas: 0, enviadas: 0, sustituidas: 0, retiradas: 0, pagadas_en_caja: 0, conflictos: 0, pendientes: 0, error: null }
const resumen = (r: Partial<ResumenCaja>): ResumenCaja => ({ ...ceros, ...r })

describe('leerResumenCaja', () => {
  it('names the header', () => expect(ENCABEZADO_CAJA).toBe('Srtm-Caja'))

  it('absent or unreadable, nothing', () => {
    expect(leerResumenCaja(null)).toBeNull()
    expect(leerResumenCaja('')).toBeNull()
    expect(leerResumenCaja('no es json')).toBeNull()
    expect(leerResumenCaja('null')).toBeNull()
  })

  it('reads the counts, missing ones are 0, non-ascii escaped', () => {
    expect(leerResumenCaja('{"enviadas":2,"pagadas_en_caja":1,"error":"ca\\u00edda"}')).toEqual(resumen({ enviadas: 2, pagadas_en_caja: 1, error: 'caída' }))
  })
})

describe('mensajesDeCaja', () => {
  it('joins the non-zero counts in the header order', () => {
    expect(mensajesDeCaja(resumen({ enviadas: 2, sustituidas: 1 }))).toEqual([{ tono: 'success', texto: 'Caja: 2 órdenes enviadas, 1 sustituida' }])
    expect(mensajesDeCaja(resumen({ enviadas: 1, retiradas: 3, pagadas_en_caja: 2, pendientes: 4 }))).toEqual([
      { tono: 'success', texto: 'Caja: 1 orden enviada, 3 retiradas, 2 pagadas en caja, 4 pendientes' }
    ])
  })

  it('singular when N is 1', () => {
    expect(mensajesDeCaja(resumen({ retiradas: 1, pagadas_en_caja: 1, pendientes: 1 }))[0].texto).toBe('Caja: 1 orden retirada, 1 pagada en caja, 1 pendiente')
  })

  it('a conflict makes it a warning', () => {
    expect(mensajesDeCaja(resumen({ enviadas: 1, conflictos: 2 }))).toEqual([{ tono: 'warning', texto: 'Caja: 1 orden enviada, 2 en conflicto' }])
  })

  it('an error adds a warning', () => {
    expect(mensajesDeCaja(resumen({ enviadas: 1, error: 'timeout' }))).toEqual([
      { tono: 'success', texto: 'Caja: 1 orden enviada' },
      { tono: 'warning', texto: 'Caja no respondió: timeout' }
    ])
    expect(mensajesDeCaja(resumen({ error: 'timeout' }))).toEqual([{ tono: 'warning', texto: 'Caja no respondió: timeout' }])
  })

  it('all zeros, nothing', () => expect(mensajesDeCaja(ceros)).toEqual([]))
})

describe('cambioCaja', () => {
  it('is true when any count but pendientes is above 0', () => {
    expect(cambioCaja(resumen({ pendientes: 3 }))).toBe(false)
    expect(cambioCaja(ceros)).toBe(false)
    for (const k of ['encoladas', 'enviadas', 'sustituidas', 'retiradas', 'pagadas_en_caja', 'conflictos'] as const)
      expect(cambioCaja(resumen({ [k]: 1 }))).toBe(true)
  })
})

describe('el canal', () => {
  it('a write and a removal publish the header', async () => {
    localStorage.setItem('srtm.token', 't')
    fetch = mockFetch([
      { method: 'PUT', path: '/srtm/niveles/n1', body: { id: 'n1' } },
      { method: 'DELETE', path: '/srtm/niveles/n1', status: 204 }
    ])
    const anterior = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const r = await anterior(input, init)
      const headers = new Headers(r.headers)
      headers.set('Srtm-Caja', '{"enviadas":2,"error":null}')
      return new Response(r.status === 204 ? null : await r.text(), { status: r.status, headers })
    }
    const oidos: ResumenCaja[] = []
    const dejar = escucharCaja((r) => oidos.push(r))
    await rentas.niveles.actualizar('n1', { id: 'n1' } as never)
    await rentas.niveles.borrar('n1')
    dejar()
    expect(oidos).toEqual([resumen({ enviadas: 2 }), resumen({ enviadas: 2 })])
  })
})

describe('el aviso de caja', () => {
  function montar() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
    render(
      <QueryClientProvider client={queryClient}>
        <AvisosDeArbitrios />
      </QueryClientProvider>
    )
    return { invalidar }
  }

  it('shows it, reads caja again and fades', () => {
    vi.useFakeTimers()
    const { invalidar } = montar()
    act(() => publicarCaja(resumen({ enviadas: 2, sustituidas: 1 })))
    expect(screen.getByTestId('aviso-caja')).toHaveTextContent('Caja: 2 órdenes enviadas, 1 sustituida')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['caja'] })
    act(() => vi.advanceTimersByTime(DURACION_AVISO))
    expect(screen.queryByTestId('aviso-caja')).not.toBeInTheDocument()
  })

  it('only pendientes: shown, nothing read again', () => {
    const { invalidar } = montar()
    act(() => publicarCaja(resumen({ pendientes: 2 })))
    expect(screen.getByTestId('aviso-caja')).toBeInTheDocument()
    expect(invalidar).not.toHaveBeenCalled()
  })

  it('a warning stays', () => {
    vi.useFakeTimers()
    montar()
    act(() => publicarCaja(resumen({ error: 'timeout' })))
    act(() => vi.advanceTimersByTime(DURACION_AVISO * 3))
    expect(screen.getByTestId('aviso-caja')).toHaveTextContent('Caja no respondió: timeout')
  })

  it('both headers show both avisos', async () => {
    const { publicarRedeterminacion } = await import('./components/avisoArbitrios')
    montar()
    act(() => {
      publicarRedeterminacion({ redeterminadas: 1, anuladas: 0, error: null })
      publicarCaja(resumen({ enviadas: 1 }))
    })
    expect(screen.getByTestId('aviso-arbitrios')).toBeInTheDocument()
    expect(screen.getByTestId('aviso-caja')).toBeInTheDocument()
  })
})
