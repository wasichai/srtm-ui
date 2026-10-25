import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { AdminApp } from './AdminApp'

// jsdom has no webgl: a map that never loads is enough for the field around it (vite.config.ts inlines @wasichai/gis
// so that its own import of maplibre gets this mock)
vi.mock('maplibre-gl', () => {
  class Map {
    addControl() {}
    on() {}
    remove() {}
  }
  class Control {}
  return { Map, NavigationControl: Control, ScaleControl: Control, Popup: Control, RasterTileSource: Control, setWorkerUrl: () => {} }
})

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/admin')
})
afterEach(() => fetch?.restore())

// an object with a geometry field, as core answers it with wasichai-gis installed
const predio = {
  id: 'o-predio',
  name: 'predio',
  label: 'Predio',
  pluralLabel: 'Predios',
  description: null,
  enabled: true,
  geometry: { type: 'POLYGON', srid: 4326, dimension: 2 }
}

const field = (name: string, label: string, type: string, extra: object = {}) => ({
  id: `f-${name}`,
  name,
  label,
  type,
  required: false,
  unique: false,
  defaultValue: null,
  description: null,
  position: 0,
  enumOptions: null,
  relationTarget: null,
  visible: true,
  editable: true,
  ...extra
})

// mounts the real App and signs in through its login form. anything else gets the mock's 404 problem
async function signIn(objects: object[] = []) {
  fetch = mockFetch([
    { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/objects', body: objects }
  ])
  render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
  const email = await screen.findByLabelText('Correo')
  await userEvent.clear(email)
  await userEvent.type(email, 'admin@wasichai.local')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
}

describe('admin', () => {
  it('signs the seeded admin in', async () => {
    await signIn()
    expect(screen.getAllByText('Rentas municipales').length).toBeGreaterThan(0)
    expect(localStorage.getItem('srtm.token')).toBe('t')
  })

  it('adds the screens of the backend modules, and only those', async () => {
    await signIn()
    for (const label of ['Workflows', 'Páginas', 'Vistas', 'Formularios', 'Documentos', 'Mapas', 'Capas']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Reglas', 'Asistente']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })

  // the portal's themes are the admin's too: a pick on either side shows on the other
  it('offers the srtm themes, and opens on the one the portal stored', async () => {
    localStorage.setItem('srtm.theme', 'portal-tributario')
    await signIn()
    expect(document.documentElement.dataset.theme).toBe('portal-tributario')
    const theme = screen.getByRole('combobox', { name: 'Tema' })
    expect(theme).toHaveValue('portal-tributario')
    expect(screen.getByRole('option', { name: 'Portal tributario' })).toBeInTheDocument()

    await userEvent.selectOptions(theme, 'dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('srtm.theme')).toBe('dark')
  })

  // lote_geom and ubicacion are GEOMETRY fields: without wasichai-gis the admin cannot show or edit them
  it('knows the geometry of the spatial objects', async () => {
    await signIn([predio])
    expect(await screen.findByText('Objetos con geometría')).toBeInTheDocument()
    expect(screen.getByText('POLYGON · EPSG:4326')).toBeInTheDocument()
  })

  it('draws a geometry field on a map instead of refusing it', async () => {
    localStorage.setItem('srtm.token', 't')
    localStorage.setItem('srtm.user', JSON.stringify(admin))
    window.history.pushState({}, '', '/admin/data/objects/predio/records/new')
    const lote = field('lote_geom', 'Lote', 'GEOMETRY', { geometry: predio.geometry })
    fetch = mockFetch([
      { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
      { path: '/objects', body: [predio] },
      { path: '/metadata/objects/predio', body: { ...predio, fields: [field('codigo', 'Código', 'TEXT'), lote] } }
    ])
    render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
    expect(await screen.findByLabelText('Código')).toBeInTheDocument()
    expect(screen.getByText('Lote')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar lote_geom' })).toBeInTheDocument()
    expect(screen.queryByDisplayValue(/no está disponible/)).not.toBeInTheDocument()
  })

  // a cashier in Lima types the hour on the wall clock: 22:00 there is 03:00 UTC of the next day, whatever the zone
  // of the browser
  it('writes a DATETIME as Lima wall time', async () => {
    localStorage.setItem('srtm.token', 't')
    localStorage.setItem('srtm.user', JSON.stringify(admin))
    window.history.pushState({}, '', '/admin/data/objects/caja/records/new')
    const caja = { ...predio, id: 'o-caja', name: 'caja', label: 'Caja', pluralLabel: 'Cajas', geometry: undefined }
    fetch = mockFetch([
      { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
      { path: '/objects', body: [caja] },
      { path: '/metadata/objects/caja', body: { ...caja, fields: [field('abierta_en', 'Abierta en', 'DATETIME')] } },
      { method: 'POST', path: '/objects/caja/records', status: 201, body: { id: 'r1', attributes: {} } }
    ])
    render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
    const abierta = await screen.findByLabelText('Abierta en')
    expect(screen.getByText('Hora de America/Lima')).toBeInTheDocument()
    fireEvent.change(abierta, { target: { value: '2026-10-19T22:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await vi.waitFor(() => expect(fetch!.calls.some((c) => c.method === 'POST' && c.path === '/objects/caja/records')).toBe(true))
    const alta = fetch.calls.find((c) => c.method === 'POST' && c.path === '/objects/caja/records')!
    expect((alta.body as { attributes: Record<string, unknown> }).attributes.abierta_en).toBe('2026-10-20T03:00:00.000Z')
  })

  it('says the model lives in the repository', async () => {
    await signIn()
    await userEvent.click(screen.getByRole('link', { name: 'Objetos' }))
    expect(await screen.findByText(/La fuente de verdad de los objetos/)).toBeInTheDocument()
  })
})
