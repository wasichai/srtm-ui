import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// clase de uso -> sub clase de uso -> uso del predio, over the srtm's catalog of usos (issue #13, pages 17 and 20)

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const contribuyente = { id: 'c1', tipo_persona: 'NATURAL', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const predio = { id: 'p1', codigo: '01-01-0001', numero_registro: 5243, condicion: 'URBANO', direccion: 'JR. LIMA 123' }
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  numero_declaracion: 39147,
  secuencia_uso: '001',
  clase_uso: null,
  sub_clase_uso: null,
  uso: null,
  area_terreno: 120,
  area_construida: null,
  valor_autoavaluo: null,
  valor_condominio: null,
  deduccion: null,
  valor_afecto: null
}

// 0901 and 0902 are both RESIDENCIAL in the srtm: one sub clase to choose, with the usos of both
const usos = [
  { codigo: '010101', clase: 'RESIDENCIAL', sub_clase: 'UNIFAMILIAR', uso: 'CASA HABITACIÓN' },
  { codigo: '010201', clase: 'RESIDENCIAL', sub_clase: 'MULTIFAMILIAR', uso: 'EDIFICIO' },
  { codigo: '010202', clase: 'RESIDENCIAL', sub_clase: 'MULTIFAMILIAR', uso: 'QUINTA' },
  { codigo: '090101', clase: 'ESTACIONAMIENTO', sub_clase: 'RESIDENCIAL', uso: 'CASA HABITACIÓN' },
  { codigo: '090201', clase: 'ESTACIONAMIENTO', sub_clase: 'RESIDENCIAL', uso: 'EDIFICIO' },
  { codigo: '100106', clase: 'BIENES COMUNES', sub_clase: 'RESIDENCIAL', uso: 'CASA HABITACIÓN' }
]

function routes(stored: object): MockRoute[] {
  const dj = { declaracion: { ...declaracion, ...stored }, predio, contribuyente, actualizado: null }
  return [
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
    { path: '/srtm/catalogos', body: { declaracion_predial: {} } },
    { path: '/srtm/usos-predio', body: usos },
    { path: '/srtm/categorias-valor', body: [] },
    { method: 'PUT', path: '/srtm/declaraciones/d1', body: dj.declaracion },
    { path: '/srtm/declaraciones/d1', body: dj },
    { path: '/srtm/declaraciones/d1/niveles', body: [] },
    { path: '/srtm/declaraciones/d1/obras', body: [] }
  ]
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

// the características of the declaration, in edit mode
async function editar(stored: object = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', '/declaraciones/d1?tab=caracteristicas')
  fetch = mockFetch(routes(stored))
  render(<PortalApp />)
  const panel = within(await screen.findByRole('tabpanel'))
  await userEvent.click(await panel.findByRole('button', { name: 'Editar' }))
  await panel.findByRole('option', { name: 'BIENES COMUNES' })
  return panel
}

const opciones = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => o.textContent)

const put = () => waitFor(() => fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')!)

describe('clase, sub clase and uso of the predio', () => {
  it('offers the sub clases of the chosen clase and the usos of the chosen sub clase', async () => {
    const panel = await editar()
    const clase = panel.getByLabelText(/Clase de uso/)
    const subClase = panel.getByLabelText(/Sub clase de uso/)
    const uso = panel.getByLabelText(/Uso del predio/)
    expect(opciones(clase)).toEqual(['SELECCIONAR', 'RESIDENCIAL', 'ESTACIONAMIENTO', 'BIENES COMUNES'])
    expect(opciones(subClase)).toEqual(['SELECCIONAR'])
    expect(opciones(uso)).toEqual(['SELECCIONAR'])

    await userEvent.selectOptions(clase, 'RESIDENCIAL')
    expect(opciones(subClase)).toEqual(['SELECCIONAR', 'UNIFAMILIAR', 'MULTIFAMILIAR'])
    await userEvent.selectOptions(subClase, 'MULTIFAMILIAR')
    expect(opciones(uso)).toEqual(['SELECCIONAR', 'EDIFICIO', 'QUINTA'])

    await userEvent.selectOptions(clase, 'ESTACIONAMIENTO')
    expect(opciones(subClase)).toEqual(['SELECCIONAR', 'RESIDENCIAL'])
    await userEvent.selectOptions(subClase, 'RESIDENCIAL')
    expect(opciones(uso)).toEqual(['SELECCIONAR', 'CASA HABITACIÓN', 'EDIFICIO'])
  })

  it('clears sub clase and uso when the clase changes, and the uso when the sub clase does', async () => {
    const panel = await editar()
    const clase = panel.getByLabelText(/Clase de uso/)
    const subClase = panel.getByLabelText(/Sub clase de uso/)
    const uso = panel.getByLabelText(/Uso del predio/)

    await userEvent.selectOptions(clase, 'RESIDENCIAL')
    await userEvent.selectOptions(subClase, 'MULTIFAMILIAR')
    await userEvent.selectOptions(uso, 'QUINTA')
    await userEvent.selectOptions(subClase, 'UNIFAMILIAR')
    expect(uso).toHaveValue('')
    expect(opciones(uso)).toEqual(['SELECCIONAR', 'CASA HABITACIÓN'])

    await userEvent.selectOptions(uso, 'CASA HABITACIÓN')
    await userEvent.selectOptions(clase, 'BIENES COMUNES')
    expect(subClase).toHaveValue('')
    expect(uso).toHaveValue('')
  })

  it('saves the clase, sub clase and uso chosen', async () => {
    const panel = await editar()
    await userEvent.selectOptions(panel.getByLabelText(/Clase de uso/), 'BIENES COMUNES')
    await userEvent.selectOptions(panel.getByLabelText(/Sub clase de uso/), 'RESIDENCIAL')
    await userEvent.selectOptions(panel.getByLabelText(/Uso del predio/), 'CASA HABITACIÓN')
    await userEvent.click(panel.getByRole('button', { name: 'Guardar cambios' }))

    expect((await put()).body).toMatchObject({ clase_uso: 'BIENES COMUNES', sub_clase_uso: 'RESIDENCIAL', uso: 'CASA HABITACIÓN', area_terreno: 120 })
  })

  it('asks for the three when the declaration has no uso', async () => {
    const panel = await editar()
    await userEvent.click(panel.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(panel.getByLabelText(/Clase de uso/)).toHaveAttribute('aria-invalid', 'true'))
    expect(panel.getByLabelText(/Sub clase de uso/)).toHaveAttribute('aria-invalid', 'true')
    expect(panel.getByLabelText(/Uso del predio/)).toHaveAttribute('aria-invalid', 'true')
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it("lists the srtm's clase, sub clase and uso in the ficha", async () => {
    localStorage.setItem('srtm.token', 't')
    localStorage.setItem('srtm.user', JSON.stringify(admin))
    window.history.pushState({}, '', '/declaraciones/d1?tab=caracteristicas')
    fetch = mockFetch(routes({ clase_uso: 'RESIDENCIAL', sub_clase_uso: 'UNIFAMILIAR', uso: 'CASA HABITACIÓN' }))
    render(<PortalApp />)
    const panel = within(await screen.findByRole('tabpanel'))
    expect(await panel.findByText('Clase de uso')).toBeInTheDocument()
    expect(panel.getByText('RESIDENCIAL')).toBeInTheDocument()
    expect(panel.getByText('UNIFAMILIAR')).toBeInTheDocument()
    expect(panel.getByText('CASA HABITACIÓN')).toBeInTheDocument()
  })

  it("keeps the padron's uso, stored without clase, through an edit that does not touch it", async () => {
    const panel = await editar({ uso: 'RESIDENCIAL - CASA HABITACION' })
    expect(panel.getByLabelText(/Uso del predio/)).toHaveValue('RESIDENCIAL - CASA HABITACION')
    // nothing to choose it from: clase and sub clase are not asked for
    expect(panel.getByText('Clase de uso')).not.toHaveTextContent('*')
    await userEvent.clear(panel.getByLabelText(/Área del terreno/))
    await userEvent.type(panel.getByLabelText(/Área del terreno/), '150')
    await userEvent.click(panel.getByRole('button', { name: 'Guardar cambios' }))

    expect((await put()).body).toMatchObject({ uso: 'RESIDENCIAL - CASA HABITACION', clase_uso: null, sub_clase_uso: null, area_terreno: 150 })
  })

  it("drops the padron's uso once a clase is chosen, and then asks for the three", async () => {
    const panel = await editar({ uso: 'RESIDENCIAL - CASA HABITACION' })
    await userEvent.selectOptions(panel.getByLabelText(/Clase de uso/), 'RESIDENCIAL')
    expect(panel.getByLabelText(/Uso del predio/)).toHaveValue('')
    expect(opciones(panel.getByLabelText(/Uso del predio/))).toEqual(['SELECCIONAR'])
    await userEvent.click(panel.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(panel.getByLabelText(/Sub clase de uso/)).toHaveAttribute('aria-invalid', 'true'))
    expect(panel.getByLabelText(/Uso del predio/)).toHaveAttribute('aria-invalid', 'true')
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
  })
})
