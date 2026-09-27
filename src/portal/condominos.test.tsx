import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// "datos de los condóminos" of a declaración jurada: the titulares of its predio, year and secuencia, with their
// parts, a new condómino and a condómino's % (srtm-backend#4: the backend derives the rest)

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const rosa = { id: 'c2', tipo_documento: 'DNI', numero_documento: '43434352', nombre_completo: 'NEIRA CAMPOS ROSA' }
const pedro = { id: 'c3', tipo_documento: 'DNI', numero_documento: '41112223', nombre_completo: 'PEREZ LUNA PEDRO' }
const compartido = { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', condicion: 'URBANO' }
const propio = { id: 'p2', codigo: '01-01-0002', direccion: 'JR. LIMA 125', condicion: 'URBANO' }

const declaracion = (id: string, contribuyente: string, predio: string, valores: Record<string, unknown>) => ({
  id,
  contribuyente,
  predio,
  anio: year,
  secuencia_uso: '1',
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACIÓN',
  valor_autoavaluo: 10000.5,
  deduccion: null,
  ...valores
})
// p1 is worth 10000.50: 60 % juan's, 40 % rosa's. pedro declares another secuencia of it
const deJuan = declaracion('d1', 'c1', 'p1', {
  numero_declaracion: 39147,
  condicion_propiedad: 'CONDOMINO',
  porcentaje_condominio: 60,
  valor_condominio: 6000.3,
  deduccion: 1000,
  valor_afecto: 5000.3
})
const deRosa = declaracion('d2', 'c2', 'p1', {
  numero_declaracion: 39148,
  condicion_propiedad: 'CONDOMINO',
  porcentaje_condominio: 40,
  valor_condominio: 4000.2,
  valor_afecto: 4000.2
})
const otraSecuencia = declaracion('d4', 'c3', 'p1', {
  secuencia_uso: '2',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100
})
// p2 is juan's alone
const soloDeJuan = declaracion('d3', 'c1', 'p2', {
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  valor_condominio: 10000.5,
  valor_afecto: 10000.5
})
const ficha = (d: object, predio: object, contribuyente: object) => ({ declaracion: d, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' })
const page = (content: unknown[]) => ({ content, page: 0, size: 8, totalElements: content.length, totalPages: 1 })

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/declaraciones/d1', body: ficha(deJuan, compartido, juan) },
  { path: '/srtm/declaraciones/d2', body: ficha(deRosa, compartido, rosa) },
  { path: '/srtm/declaraciones/d3', body: ficha(soloDeJuan, propio, juan) },
  {
    path: '/srtm/predios/p1/declaraciones',
    body: [
      { declaracion: deJuan, predio: null, contribuyente: juan },
      { declaracion: deRosa, predio: null, contribuyente: rosa },
      { declaracion: otraSecuencia, predio: null, contribuyente: pedro }
    ]
  },
  { path: '/srtm/predios/p2/declaraciones', body: [{ declaracion: soloDeJuan, predio: null, contribuyente: juan }] },
  { path: '/srtm/predios/p1', body: { predio: compartido, anio: year, titulares: 3, totales: { declaraciones: 3, autoavaluo: 20001, valor_afecto: 19001 } } },
  { path: '/srtm/predios/p2', body: { predio: propio, anio: year, titulares: 1, totales: { declaraciones: 1, autoavaluo: 10000.5, valor_afecto: 10000.5 } } },
  { path: '/srtm/contribuyentes', body: page([pedro]) }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const called = (method: string, path: string) => fetch!.calls.find((c) => c.method === method && c.path === path)

describe('datos de los condóminos', () => {
  it("lists the titulares of the declaration's predio, year and secuencia, with the parts they add up to", async () => {
    start('/declaraciones/d1?tab=condominos')
    const rosaRow = (await screen.findByRole('link', { name: 'NEIRA CAMPOS ROSA' })).closest('tr')!
    expect(rosaRow).toHaveTextContent('CONDOMINO')
    expect(within(rosaRow).getByRole('cell', { name: '40' })).toBeInTheDocument()
    expect(screen.getByText(/suman 100 % de propiedad/)).toBeInTheDocument()
    // another secuencia de uso is another condominio
    expect(screen.queryByText('PEREZ LUNA PEDRO')).not.toBeInTheDocument()
  })

  it("adds a condómino to a propietario único's declaration", async () => {
    start('/declaraciones/d3?tab=condominos', [{ method: 'POST', path: '/srtm/declaraciones/d3/condominos', status: 201, body: { id: 'd5' } }])
    // a sole titular's tab is where its first condómino comes from
    expect(await screen.findByRole('tab', { name: 'Datos de los condóminos' })).toBeEnabled()
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar condómino' }))
    const dialog = await screen.findByRole('dialog', { name: 'Agregar condómino' })
    await userEvent.type(within(dialog).getByLabelText(/% de propiedad/), '25')
    // who, first
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(within(dialog).getByText('Elige un contribuyente')).toBeInTheDocument()
    expect(called('POST', '/srtm/declaraciones/d3/condominos')).toBeUndefined()

    await userEvent.type(within(dialog).getByPlaceholderText('DNI, RUC o nombre'), 'PEREZ')
    await userEvent.click(await within(dialog).findByRole('button', { name: /PEREZ LUNA PEDRO/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await waitFor(() => {
      const call = called('POST', '/srtm/declaraciones/d3/condominos')
      expect(call).toBeDefined()
      return call!
    })
    expect(post.body).toEqual({ contribuyente: 'c3', porcentaje_condominio: 25 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it("changes a condómino's % over its declaration as it is now", async () => {
    start('/declaraciones/d1?tab=condominos', [{ method: 'PUT', path: '/srtm/declaraciones/d2', body: deRosa }])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar % de propiedad de NEIRA CAMPOS ROSA' }))
    const dialog = await screen.findByRole('dialog', { name: '% de propiedad de NEIRA CAMPOS ROSA' })
    const input = within(dialog).getByLabelText(/% de propiedad/)
    expect(input).toHaveValue('40')
    await userEvent.clear(input)
    await userEvent.type(input, '30')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const put = await waitFor(() => {
      const call = called('PUT', '/srtm/declaraciones/d2')
      expect(call).toBeDefined()
      return call!
    })
    expect(put.body).toMatchObject({
      contribuyente: 'c2',
      predio: 'p1',
      clase_uso: 'RESIDENCIAL',
      sub_clase_uso: 'UNIFAMILIAR',
      uso: 'CASA HABITACIÓN',
      porcentaje_condominio: 30
    })
  })

  it('shows under the % why the backend refused it', async () => {
    start('/declaraciones/d1?tab=condominos', [
      {
        method: 'PUT',
        path: '/srtm/declaraciones/d2',
        status: 400,
        body: {
          title: 'Bad Request',
          detail: 'Los % de propiedad del predio sumarían 110 % (máximo 100 %)',
          errors: [{ field: 'porcentaje_condominio', message: 'excede el 100 %' }]
        }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar % de propiedad de NEIRA CAMPOS ROSA' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText(/% de propiedad/))
    await userEvent.type(within(dialog).getByLabelText(/% de propiedad/), '50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(await within(dialog).findByText('excede el 100 %')).toBeInTheDocument()
  })
})
