import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '20529936',
  nombre_completo: 'QUISPE MAMANI JUAN',
  apellido_paterno: 'QUISPE',
  apellido_materno: 'MAMANI',
  nombres: 'JUAN',
  razon_social: null,
  domicilio_fiscal: 'JR. LIMA 123',
  domicilio_distrito: 'PERENE',
  domicilio_provincia: 'CHANCHAMAYO',
  domicilio_departamento: 'JUNIN'
}
const predio = {
  id: 'p1',
  codigo: '01-01-0001',
  sector_catastral: '01',
  manzana_catastral: '01',
  condicion: 'URBANO',
  direccion: 'JR. LIMA 123',
  via: null,
  numero: '123',
  manzana: null,
  lote: null,
  habilitacion_urbana: null,
  ubicacion_area_verde: null
}
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  secuencia_uso: '1',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  uso: 'RESIDENCIAL - CASA HABITACION',
  clasificacion: null,
  estado_construccion: 'TERMINADO',
  area_terreno: 120,
  area_construida: 90,
  longitud_frente: 8,
  numero_habitantes: 4,
  valor_autoavaluo: 10080.45,
  valor_condominio: null,
  deduccion: null,
  valor_afecto: 8000
}
const totales = { declaraciones: 1, autoavaluo: 10080.45, valor_afecto: 8000 }
const page = (content: unknown[], pageNumber = 0, totalElements = content.length, totalPages = 1) => ({
  content,
  page: pageNumber,
  size: 20,
  totalElements,
  totalPages
})

const routes: MockRoute[] = [
  { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { method: 'PUT', path: '/auth/me/preferences', body: { theme: 'light', locale: null } },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 11840, predios: 14947, declaraciones: 15644 } },
  {
    path: '/srtm/catalogos',
    body: { contribuyente: { tipo_persona: ['NATURAL', 'JURIDICA'], tipo_documento: ['DNI', 'RUC'] }, predio: {}, declaracion_predial: {} }
  },
  { path: /^\/srtm\/contribuyentes\?.*page=1/, body: page([{ ...contribuyente, id: 'c2', nombre_completo: 'SEGUNDA PAGINA' }], 1, 21, 2) },
  { path: '/srtm/contribuyentes', body: page([contribuyente], 0, 21, 2) },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/contribuyentes/c1/declaraciones', body: [{ declaracion, predio, contribuyente: null }] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente }] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = [], signedIn = true) {
  if (signedIn) {
    localStorage.setItem('srtm.token', 't')
    localStorage.setItem('srtm.user', JSON.stringify(admin))
  }
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const tabBar = () => screen.getByRole('navigation', { name: 'Fichas abiertas' })

describe('portal', () => {
  it('sends a stranger to the login, and back where they were going after it', async () => {
    start('/contribuyentes', [], false)
    await userEvent.type(await screen.findByLabelText('Contraseña'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('heading', { name: 'Contribuyentes' })).toBeInTheDocument()
    // the admin reads the same keys: one sign-in for both
    expect(localStorage.getItem('srtm.token')).toBe('t')
    expect(JSON.parse(localStorage.getItem('srtm.user')!).email).toBe('admin@wasichai.local')
  })

  it('opens on the home page with the padron totals', async () => {
    start('/')
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(await screen.findByText((11840).toLocaleString('es-PE'))).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
  })

  it('switches the theme and stores it for the user, as the admin does', async () => {
    start('/')
    await userEvent.click(await screen.findByRole('button', { name: /^Tema: Sistema/ }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(localStorage.getItem('srtm.theme')).toBe('light')
    await waitFor(() => expect(fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/auth/me/preferences')?.body).toEqual({ theme: 'light' }))
  })

  it('searches contribuyentes and pages through them', async () => {
    start('/contribuyentes')
    expect(await screen.findByText('QUISPE MAMANI JUAN')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar contribuyentes'), 'quispe')
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/contribuyentes?q=quispe'))).toBe(true))
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(await screen.findByText('SEGUNDA PAGINA')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  })

  it('keeps every open ficha as a workspace tab, and closing one moves to its neighbour', async () => {
    start('/contribuyentes')
    await userEvent.click(await screen.findByRole('link', { name: '20529936' }))
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    expect(await within(tabBar()).findByRole('link', { name: /20529936 QUISPE MAMANI JUAN/ })).toBeInTheDocument()

    // from the contribuyente's predios to the predio: a second tab
    await userEvent.click(screen.getByRole('tab', { name: 'Predios' }))
    await userEvent.click(await screen.findByRole('link', { name: '01-01-0001' }))
    expect(await screen.findByRole('heading', { name: '01-01-0001 · JR. LIMA 123' })).toBeInTheDocument()
    expect(await within(tabBar()).findByRole('link', { name: '01-01-0001' })).toBeInTheDocument()

    await userEvent.click(within(tabBar()).getByRole('button', { name: 'Cerrar 01-01-0001' }))
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    expect(within(tabBar()).queryByRole('link', { name: '01-01-0001' })).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('srtm.tabs')!)).toHaveLength(1)
  })

  it('loads a ficha tab only when it is opened: the year for Predios, every year for Declaraciones', async () => {
    start('/contribuyentes/c1')
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    const declaraciones = () => fetch!.calls.filter((c) => c.path.startsWith('/srtm/contribuyentes/c1/declaraciones'))
    expect(declaraciones()).toHaveLength(0)

    await userEvent.click(screen.getByRole('tab', { name: 'Predios' }))
    expect(await screen.findByText(`Total ${year}`)).toBeInTheDocument()
    expect(declaraciones().map((c) => c.path)).toEqual([`/srtm/contribuyentes/c1/declaraciones?anio=${year}`])

    await userEvent.click(screen.getByRole('tab', { name: 'Declaraciones' }))
    expect(await screen.findByRole('button', { name: `Editar declaración ${year}` })).toBeInTheDocument()
    expect(declaraciones().map((c) => c.path)).toContain('/srtm/contribuyentes/c1/declaraciones')
  })

  it('edits a contribuyente and shows the field the backend rejects under that field', async () => {
    start('/contribuyentes/c1', [
      {
        method: 'PUT',
        path: '/srtm/contribuyentes/c1',
        status: 400,
        body: { title: 'Bad Request', detail: 'invalid record', errors: [{ field: 'numero_documento', message: 'ya existe' }] }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const domicilio = screen.getByLabelText('Dirección')
    await userEvent.clear(domicilio)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('ya existe')).toBeInTheDocument()
    expect(screen.getByLabelText(/Número de documento/)).toHaveAttribute('aria-invalid', 'true')
    const put = fetch!.calls.find((c) => c.method === 'PUT')!
    // a cleared field goes as null, so the backend clears it too
    expect(put.body).toMatchObject({ numero_documento: '20529936', domicilio_fiscal: null, tipo_persona: 'NATURAL' })
  })
})
