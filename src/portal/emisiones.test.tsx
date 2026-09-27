import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// la emisión masiva de HR y PU de un año (wasichai/srtm-ui#62, épica wasichai/srtm-backend#37): se lanza, se sigue su
// avance mientras corre en segundo plano y, al terminar, se descarga el archivo

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const job = (valores: Record<string, unknown>) => ({
  id: 'e1',
  anio: year,
  formato: 'PDF',
  estado: 'PENDIENTE',
  total: 0,
  procesados: 0,
  errores: [],
  archivo: null,
  tamano: null,
  mensaje: null,
  iniciado: `${year}-09-27T15:00:00Z`,
  terminado: null,
  ...valores
})

const base: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// lista: the route of GET /srtm/emisiones, whose body a test changes as the backend's job moves on
function start(path: string, lista: MockRoute, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, lista, ...base])
  render(<PortalApp />)
}

const pedidosDeLista = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path === '/srtm/emisiones').length
const filas = () =>
  within(screen.getByRole('table', { name: 'Emisiones' }))
    .getAllByRole('row')
    .slice(1)

describe('emisión masiva', () => {
  it('is reached from the menu', async () => {
    start('/', { path: '/srtm/emisiones', body: [] })
    const menu = await screen.findByRole('navigation', { name: 'Secciones' })
    await userEvent.click(within(menu).getByRole('link', { name: 'Emisión masiva' }))
    expect(await screen.findByRole('heading', { name: 'Emisión masiva' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/emisiones')
  })

  it('emits for the current year by default, with the format picked, and lists the new job', async () => {
    const lista: MockRoute = { path: '/srtm/emisiones', body: [] }
    const nuevo = job({ id: 'e9', formato: 'ZIP' })
    start('/emisiones', lista, [{ method: 'POST', path: '/srtm/emisiones', status: 202, body: nuevo }])
    expect(await screen.findByText('Aún no hay emisiones')).toBeInTheDocument()

    expect(screen.getByLabelText('Año')).toHaveValue(String(year))
    expect(screen.getByLabelText('Un solo PDF')).toBeChecked()
    await userEvent.click(screen.getByLabelText('ZIP: un PDF por predio y la HR de cada contribuyente'))
    lista.body = [nuevo]
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))

    expect(fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/emisiones')?.body).toEqual({ anio: year, formato: 'ZIP' })
    await waitFor(() => expect(filas()).toHaveLength(1))
    const [fila] = filas()
    expect(fila).toHaveTextContent(String(year))
    expect(fila).toHaveTextContent('ZIP')
    expect(fila).toHaveTextContent('Pendiente')
  })

  it('emits for another year when picked', async () => {
    start('/emisiones', { path: '/srtm/emisiones', body: [] }, [{ method: 'POST', path: '/srtm/emisiones', status: 202, body: job({ anio: year - 1 }) }])
    await screen.findByText('Aún no hay emisiones')
    await userEvent.selectOptions(screen.getByLabelText('Año'), String(year - 1))
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    await waitFor(() => expect(fetch!.calls.find((c) => c.method === 'POST')?.body).toEqual({ anio: year - 1, formato: 'PDF' }))
  })

  it('warns when an emission is already running (409)', async () => {
    start('/emisiones', { path: '/srtm/emisiones', body: [] }, [
      { method: 'POST', path: '/srtm/emisiones', status: 409, body: { title: 'Conflict', detail: 'Hay una emisión EN_PROCESO' } }
    ])
    await screen.findByText('Aún no hay emisiones')
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una emisión en proceso')
  })

  it('polls every 2 s while a job runs, moving its bar, and stops once it ends, offering the download', async () => {
    // only the intervals are fake: react-query's refetchInterval runs on one, the rest of the test on real time
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const lista: MockRoute = { path: '/srtm/emisiones', body: [job({ estado: 'EN_PROCESO', total: 10, procesados: 2 })] }
    start('/emisiones', lista)

    const barra = await screen.findByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuenow', '2')
    expect(barra).toHaveAttribute('aria-valuemax', '10')
    expect(filas()[0]).toHaveTextContent('2/10')
    expect(filas()[0]).toHaveTextContent('En proceso')
    expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
    expect(pedidosDeLista()).toBe(1)

    lista.body = [job({ estado: 'EN_PROCESO', total: 10, procesados: 6 })]
    await act(() => vi.advanceTimersByTimeAsync(2000))
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6'))
    expect(pedidosDeLista()).toBe(2)

    lista.body = [job({ estado: 'TERMINADA', total: 10, procesados: 10, archivo: `emision-${year}-e1.pdf`, terminado: `${year}-09-27T15:05:00Z` })]
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(await screen.findByRole('button', { name: /Descargar/ })).toBeInTheDocument()
    expect(pedidosDeLista()).toBe(3)
    expect(filas()[0]).toHaveTextContent('Terminada')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10')

    // nothing runs: no more asking
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(pedidosDeLista()).toBe(3)
  })

  it('downloads the file of a finished job with its filename', async () => {
    const terminada = job({ id: 'e7', formato: 'ZIP', estado: 'TERMINADA', total: 3, procesados: 3, archivo: 'x', tamano: 2048 })
    start('/emisiones', { path: '/srtm/emisiones', body: [terminada] })
    // mockFetch answers json only: the file comes from here, like the backend sends it
    const mocked = globalThis.fetch
    const pedidos: { url: string; auth: string | null }[] = []
    globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input)
      if (!url.endsWith('/archivo')) return mocked(input, init)
      pedidos.push({ url, auth: new Headers(init.headers).get('Authorization') })
      return new Response('PK zip', {
        status: 200,
        headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="emision-${year}-e7.zip"` }
      })
    }
    const createObjectURL = vi.fn(() => 'blob:emision')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const descargas: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargas.push(`${this.download} ${this.getAttribute('href')}`)
    })

    await userEvent.click(await screen.findByRole('button', { name: /Descargar/ }))

    await waitFor(() => expect(descargas).toEqual([`emision-${year}-e7.zip blob:emision`]))
    expect(pedidos).toEqual([{ url: '/api/srtm/emisiones/e7/archivo', auth: 'Bearer t' }])
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('shows why a job failed, and lists the contribuyentes that could not be emitted', async () => {
    start('/emisiones', {
      path: '/srtm/emisiones',
      body: [
        job({
          id: 'e2',
          estado: 'TERMINADA',
          total: 5,
          procesados: 5,
          archivo: 'x',
          errores: [
            { contribuyente: '000123', mensaje: 'Faltan parámetros del año' },
            { contribuyente: '000124', mensaje: 'Sin DJ vigente' }
          ]
        }),
        job({ id: 'e1', anio: year - 1, estado: 'FALLIDA', total: 5, procesados: 1, mensaje: 'No se pudo escribir el archivo' })
      ]
    })
    await waitFor(() => expect(filas()).toHaveLength(2))
    const [terminada, fallida] = filas()
    expect(fallida).toHaveTextContent('Fallida')
    expect(fallida).toHaveTextContent('No se pudo escribir el archivo')
    expect(within(fallida).queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()

    const errores = within(terminada).getByRole('button', { name: '2 contribuyentes con error' })
    expect(errores).toHaveAttribute('aria-expanded', 'false')
    expect(within(terminada).queryByRole('list')).not.toBeInTheDocument()
    await userEvent.click(errores)
    expect(errores).toHaveAttribute('aria-expanded', 'true')
    const items = within(within(terminada).getByRole('list')).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['000123: Faltan parámetros del año', '000124: Sin DJ vigente'])
    expect(within(terminada).getByRole('button', { name: /Descargar/ })).toBeInTheDocument()
  })
})
