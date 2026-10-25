import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// los cambios en catastro de un año: la lista de trabajo de fiscalización. los predios que el catastro cambió desde una
// fecha, con el Δ autoavalúo de la última brecha; los que pasan 5 UIT primero y marcados (srtm-backend
// /srtm/brecha/{anio}/cambios). el orden y las cifras son del backend

// jsdom has no webgl: the brecha's map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const cambios = {
  content: [
    {
      codigoMunicipal: 'CM-0101',
      predio: 'p1',
      codigoPredio: '01-01-0001',
      categoria: 'SUBVALUADO',
      cambios: 3,
      objetos: ['predio_catastral', 'construccion'],
      entregas: ['E1', 'E2'],
      ultimoCambio: `${year}-03-14T15:00:00Z`,
      autoavaluoDeclarado: 100000,
      autoavaluoCatastro: 200000,
      deltaAutoavaluo: 100000,
      marca: 'SUPERA_5_UIT'
    },
    {
      codigoMunicipal: 'CM-0102',
      predio: null,
      codigoPredio: null,
      categoria: null,
      cambios: 1,
      objetos: ['titular_catastral'],
      entregas: [],
      ultimoCambio: null,
      autoavaluoDeclarado: null,
      autoavaluoCatastro: null,
      deltaAutoavaluo: null,
      marca: null
    }
  ],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
  nextCursor: null
}

const base = (permisos: unknown): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } },
  { path: '/srtm/brecha/corridas', body: [] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.restoreAllMocks()
})

function start(path: string, lista: MockRoute = { path: `/srtm/brecha/${year}/cambios`, body: cambios }, permisos: unknown = { admin: true, objects: {} }) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([lista, ...base(permisos)])
  render(<PortalApp />)
}

const pedidos = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.split('?')[0] === `/srtm/brecha/${year}/cambios`)
const filas = () =>
  within(screen.getByRole('table', { name: 'Cambios en catastro' }))
    .getAllByRole<HTMLTableRowElement>('row')
    .slice(1)

describe('cambios en catastro', () => {
  it('lists the predios changed since the 1st of January, the marked ones first, as the backend sends them', async () => {
    start('/brecha/cambios')
    expect(await screen.findByRole('heading', { name: 'Cambios en catastro' })).toBeInTheDocument()
    await screen.findByRole('table', { name: 'Cambios en catastro' })
    // no desde: the backend takes the 1st of January
    expect(pedidos()[0].path).toBe(`/srtm/brecha/${year}/cambios?page=0&size=20`)

    const [marcada, otra] = filas()
    expect(within(marcada).getByRole('link', { name: '01-01-0001' })).toHaveAttribute('href', '/predios/p1')
    expect(marcada).toHaveTextContent('Catastro CM-0101')
    expect(marcada).toHaveTextContent('Subvaluado')
    expect(marcada).toHaveTextContent('Predio, Construcción')
    expect(marcada).toHaveTextContent('E1, E2')
    expect(marcada).toHaveTextContent('14/03/')
    expect(marcada).toHaveTextContent('S/ 100,000.00')
    expect(marcada).toHaveTextContent('S/ 200,000.00')
    expect(within(marcada).getByText('Supera 5 UIT')).toHaveAttribute('data-tono', 'ambar')
    expect(marcada).toHaveAttribute('data-marca', 'SUPERA_5_UIT')

    // one with no srtm predio and no corrida: its code as text, nothing to show
    expect(within(otra).queryByRole('link')).not.toBeInTheDocument()
    expect(otra).toHaveTextContent('CM-0102')
    expect(otra).not.toHaveTextContent('Catastro CM-0102')
    expect(otra).toHaveTextContent('Titular')
    expect(within(otra).queryByText('Supera 5 UIT')).not.toBeInTheDocument()
    expect(otra).not.toHaveAttribute('data-marca')
    expect(screen.getByText(/En blanco: el 1 de enero/)).toBeInTheDocument()
  })

  it('asks again from page 0 on each filter: desde, only those above 5 UIT, the objeto and the year', async () => {
    start('/brecha/cambios', { path: `/srtm/brecha/${year}/cambios`, body: { ...cambios, totalElements: 45, totalPages: 3 } })
    await screen.findByRole('table', { name: 'Cambios en catastro' })

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(pedidos().at(-1)?.path).toBe(`/srtm/brecha/${year}/cambios?page=1&size=20`))

    await userEvent.type(screen.getByLabelText('Desde'), `${year}-06-01`)
    await waitFor(() => expect(pedidos().at(-1)?.path).toBe(`/srtm/brecha/${year}/cambios?desde=${year}-06-01&page=0&size=20`))

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await userEvent.click(screen.getByLabelText('Solo los que superan 5 UIT'))
    await waitFor(() => expect(pedidos().at(-1)?.path).toBe(`/srtm/brecha/${year}/cambios?desde=${year}-06-01&marca=SUPERA_5_UIT&page=0&size=20`))

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await userEvent.selectOptions(screen.getByLabelText('Objeto'), 'Construcción')
    await waitFor(() =>
      expect(pedidos().at(-1)?.path).toBe(`/srtm/brecha/${year}/cambios?desde=${year}-06-01&marca=SUPERA_5_UIT&objeto=construccion&page=0&size=20`)
    )

    await userEvent.selectOptions(screen.getByLabelText('Año'), String(year - 1))
    await waitFor(() =>
      expect(fetch!.calls.at(-1)?.path).toBe(`/srtm/brecha/${year - 1}/cambios?desde=${year}-06-01&marca=SUPERA_5_UIT&objeto=construccion&page=0&size=20`)
    )
  })

  it('says when the year has no brecha yet, with the way to it', async () => {
    start('/brecha/cambios', { path: `/srtm/brecha/${year}/cambios`, status: 404, body: { title: 'Not Found', detail: 'Sin corrida' } })
    expect(await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Cambios en catastro' })).not.toBeInTheDocument()
    const enlaces = screen.getAllByRole('link', { name: /brecha de recaudación/i }).filter((a) => !a.closest('nav'))
    expect(enlaces.length).toBeGreaterThan(0)
    expect(enlaces[0]).toHaveAttribute('href', '/brecha')
  })

  it("shows the backend's detail of a 422", async () => {
    const detalle = `Falta la UIT de ${year}`
    start('/brecha/cambios', { path: `/srtm/brecha/${year}/cambios`, status: 422, body: { title: 'Unprocessable Content', detail: detalle, faltan: [] } })
    expect(await screen.findByText(detalle)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Cambios en catastro' })).not.toBeInTheDocument()
  })

  it('asks for nothing without reading the corridas', async () => {
    start('/brecha/cambios', undefined, { admin: false, objects: {} })
    expect(await screen.findByText(/Sin permiso para ver la brecha/)).toBeInTheDocument()
    expect(pedidos()).toHaveLength(0)
  })

  it('is reached from the brecha, and goes back to it; the classic menu keeps the brecha current', async () => {
    start('/brecha')
    await screen.findByRole('heading', { name: 'Brecha de recaudación' })
    await userEvent.click(screen.getByRole('link', { name: 'Cambios en catastro' }))
    expect(await screen.findByRole('heading', { name: 'Cambios en catastro' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/brecha/cambios')
    const menu = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(menu).getByRole('link', { name: 'Brecha de recaudación' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('link', { name: 'Volver a la brecha' }))
    expect(await screen.findByRole('heading', { name: 'Brecha de recaudación' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/brecha')
  })
})
