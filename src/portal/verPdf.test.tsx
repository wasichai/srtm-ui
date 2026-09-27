import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// Ver PU and Ver HR from the fichas (wasichai/srtm-ui#61): the PU of a predio for the year picked, of its one titular
// or of the one picked when it has several; the HR of a contribuyente, and the PU of each of its predios

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', codigo: '000123', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const rosa = { id: 'c2', codigo: '000124', tipo_documento: 'DNI', numero_documento: '43434352', nombre_completo: 'NEIRA CAMPOS ROSA' }
const solo = { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', condicion: 'URBANO' }
const condominio = { id: 'p3', codigo: '01-01-0003', direccion: 'JR. LIMA 127', condicion: 'URBANO' }

const declaracion = (id: string, predio: string, contribuyente: string, porcentaje: number) => ({
  id,
  predio,
  contribuyente,
  anio: year,
  secuencia_uso: '1',
  numero_declaracion: 39000 + Number(id.slice(1)),
  condicion_propiedad: porcentaje === 100 ? 'PROPIETARIO UNICO' : 'CONDOMINO',
  porcentaje_condominio: porcentaje,
  valor_autoavaluo: 10000,
  valor_afecto: 10000 * (porcentaje / 100),
  estado: 'VIGENTE'
})
const totales = { declaraciones: 1, autoavaluo: 10000, valor_afecto: 10000 }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 2, predios: 2, declaraciones: 3 } },
  // a PDF: mockFetch answers JSON, which is a body as good as any to turn into a blob
  { path: /^\/srtm\/predios\/p\d\/pu\?/, body: null },
  { path: /^\/srtm\/contribuyentes\/c\d\/hr\?/, body: null },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion: declaracion('d1', 'p1', 'c1', 100), predio: null, contribuyente: juan }] },
  { path: '/srtm/predios/p1', body: { predio: solo, anio: year, titulares: 1, totales } },
  {
    path: '/srtm/predios/p3/declaraciones',
    body: [
      { declaracion: declaracion('d2', 'p3', 'c1', 50), predio: null, contribuyente: juan },
      { declaracion: declaracion('d3', 'p3', 'c2', 50), predio: null, contribuyente: rosa }
    ]
  },
  { path: '/srtm/predios/p3', body: { predio: condominio, anio: year, titulares: 2, totales: { ...totales, declaraciones: 2 } } },
  {
    path: '/srtm/contribuyentes/c1/declaraciones',
    body: [
      { declaracion: declaracion('d1', 'p1', 'c1', 100), predio: solo, contribuyente: null },
      { declaracion: declaracion('d2', 'p3', 'c1', 50), predio: condominio, contribuyente: null }
    ]
  },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente: juan, anio: year, predios: 2, totales } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // jsdom has no object urls
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() })
})
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

// the PDFs asked for, in order
const pedidos = () => fetch!.calls.map((c) => c.path).filter((p) => /\/(pu|hr)\?/.test(p))

describe('Ver PU desde la ficha del predio', () => {
  it('opens the PU of its one titular for the year picked', async () => {
    start('/predios/p1')
    await screen.findByRole('heading', { name: /01-01-0001/ })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Año' }), String(year - 1))
    await userEvent.click(screen.getByRole('button', { name: 'Ver PU' }))
    const dialog = await screen.findByRole('dialog', { name: `PU — 01-01-0001 — ${year - 1}` })
    expect(await within(dialog).findByTitle(`PU — 01-01-0001 — ${year - 1}`)).toHaveAttribute('src', 'blob:pdf')
    expect(pedidos()).toEqual([`/srtm/predios/p1/pu?anio=${year - 1}`])
  })

  it('asks which titular first when it has several, and asks for that one', async () => {
    start('/predios/p3')
    await screen.findByRole('heading', { name: /01-01-0003/ })
    await userEvent.click(screen.getByRole('button', { name: 'Ver PU' }))
    const elegir = await screen.findByRole('dialog', { name: 'Elegir el titular' })
    expect(within(elegir).getByRole('button', { name: /QUISPE MAMANI JUAN/ })).toBeInTheDocument()
    await userEvent.click(within(elegir).getByRole('button', { name: /NEIRA CAMPOS ROSA/ }))
    const dialog = await screen.findByRole('dialog', { name: `PU — 01-01-0003 — ${year}` })
    await within(dialog).findByTitle(`PU — 01-01-0003 — ${year}`)
    expect(pedidos()).toEqual([`/srtm/predios/p3/pu?anio=${year}&contribuyente=c2`])
  })

  it('asks which titular when the backend answers 409 with them', async () => {
    const titulares = [
      { id: 'c1', nombre: 'QUISPE MAMANI JUAN', documento: '20529936' },
      { id: 'c2', nombre: 'NEIRA CAMPOS ROSA', documento: '43434352' }
    ]
    start('/predios/p1', [{ path: '/srtm/predios/p1/pu', status: 409, body: { title: 'Conflict', detail: 'Más de un titular', titulares } }])
    await screen.findByRole('heading', { name: /01-01-0001/ })
    await userEvent.click(screen.getByRole('button', { name: 'Ver PU' }))
    const elegir = await screen.findByRole('dialog', { name: 'Elegir el titular' })
    // the next answer is the PDF
    fetch!.restore()
    fetch = mockFetch(routes)
    await userEvent.click(within(elegir).getByRole('button', { name: /QUISPE MAMANI JUAN/ }))
    await screen.findByTitle(`PU — 01-01-0001 — ${year}`)
    expect(pedidos()).toEqual([`/srtm/predios/p1/pu?anio=${year}&contribuyente=c1`])
  })
})

describe('Ver HR y PU desde la ficha del contribuyente', () => {
  it('opens the HR of the year', async () => {
    start('/contribuyentes/c1')
    await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })
    await userEvent.click(screen.getByRole('button', { name: 'Ver HR' }))
    const dialog = await screen.findByRole('dialog', { name: `HR — 000123 — ${year}` })
    await within(dialog).findByTitle(`HR — 000123 — ${year}`)
    expect(pedidos()).toEqual([`/srtm/contribuyentes/c1/hr?anio=${year}`])
  })

  it('lists what is missing when the year has no parámetros (422)', async () => {
    start('/contribuyentes/c1', [
      { path: '/srtm/contribuyentes/c1/hr', status: 422, body: { title: 'Faltan parámetros', detail: 'Faltan parámetros del año', faltan: [`UIT ${year}`] } }
    ])
    await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })
    await userEvent.click(screen.getByRole('button', { name: 'Ver HR' }))
    const dialog = await screen.findByRole('dialog', { name: `HR — 000123 — ${year}` })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(`Faltan parámetros: UIT ${year}`)
  })

  it('opens the PU of each of its predios, as its titular', async () => {
    start('/contribuyentes/c1?tab=predios')
    const row = (await screen.findByRole('link', { name: '01-01-0003' })).closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Ver PU de 01-01-0003' }))
    await screen.findByTitle(`PU — 01-01-0003 — ${year}`)
    await waitFor(() => expect(pedidos()).toEqual([`/srtm/predios/p3/pu?anio=${year}&contribuyente=c1`]))
  })
})
