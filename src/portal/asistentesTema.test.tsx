import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// the wizards in the portal-tributario theme (issue #54): their tabs as chevron steps, with the instruction of the
// current one under them. the same state as the tabs: going to a step is going to its tab. light keeps the tabs alone

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '20529936',
  nombre_completo: 'QUISPE MAMANI JUAN',
  codigo: '000012'
}
const predio = { id: 'p1', codigo: '01-01-0001', numero_registro: 5243, condicion: 'URBANO', direccion: 'JR. LIMA 123', region: 'SELVA' }
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  numero_declaracion: 39147,
  secuencia_uso: '001',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACION',
  area_terreno: 120,
  tipo_adquisicion: 'COMPRA',
  fecha_adquisicion: '2024-09-04',
  folios: 2,
  documentos_sustento: 'MINUTA',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24'
}
const totales = { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 }

function routes(theme: string): MockRoute[] {
  return [
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/auth/me/preferences', body: { theme, locale: null } },
    {
      path: '/srtm/catalogos',
      body: {
        contribuyente: {
          tipo_documento: ['DNI', 'RUC'],
          tipo_contribuyente: ['PERSONA NATURAL'],
          motivo: ['INSCRIPCION'],
          medio_determinacion: ['DECLARACION JURADA'],
          medio_presentacion: ['FISICO'],
          fuente_informacion: ['MANUAL']
        },
        predio: { condicion: ['URBANO', 'RUSTICO'], region: ['SELVA'], tipo_via: ['AVENIDA'], tipo_zona: ['CENTRO POBLADO'] },
        declaracion_predial: { medio_presentacion: ['FISICO'], tipo_adquisicion: ['COMPRA'], condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO'] }
      }
    },
    { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
    { path: '/srtm/usos-predio', body: [{ codigo: '010101', clase: 'RESIDENCIAL', sub_clase: 'UNIFAMILIAR', uso: 'CASA HABITACION' }] },
    { path: '/srtm/categorias-valor', body: [] },
    { path: '/srtm/obras-categorias', body: [] },
    { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
    { path: '/srtm/contribuyentes/c1/declaraciones', body: [] },
    { path: '/srtm/contribuyentes/c1/domicilios', body: [] },
    { path: '/srtm/declaraciones/d1', body: { declaracion, predio, contribuyente, actualizado: null } },
    { path: /^\/srtm\/declaraciones\/d1\//, body: [] },
    { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
    { path: '/srtm/predios/p1/declaraciones', body: [] }
  ]
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => fetch?.restore())

// signed in, the theme picked in this browser and for the user
function start(theme: string, path: string) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', path)
  fetch = mockFetch(routes(theme))
  render(<PortalApp />)
}

const galon = () => screen.getByRole('list', { name: 'Pasos del trámite' })
const pasos = () => within(galon()).getAllByRole('listitem')
const actual = () => pasos().find((li) => li.getAttribute('aria-current') === 'step')?.textContent
// the steps that are buttons: the ones that can be gone to
const navegables = () =>
  within(galon())
    .queryAllByRole('button')
    .map((b) => b.textContent)
const instruccion = () => document.querySelector('[data-ui="barra-instruccion"] p')?.textContent
const tab = (name: string) => screen.getByRole('tab', { name })
const header = () => screen.getByRole('group', { name: 'Acciones de la declaración' })

const INSCRIPCION = ['Datos del contribuyente', 'Domicilios', 'Relacionados', 'Medios de contacto', 'Sustento']
const DJ = ['Datos del predio', 'Datos de la ubicación', 'Datos del transferente', 'Características', 'Datos de los condóminos', 'Otros frentes']

describe('the wizards with portal-tributario', () => {
  it('draws the inscription as chevron steps, on its first one, and says what it asks for', async () => {
    start('portal-tributario', '/contribuyentes/nuevo')
    expect(await screen.findByRole('heading', { name: 'Nuevo contribuyente' })).toBeInTheDocument()
    await waitFor(() => expect(galon()).toBeInTheDocument())
    expect(pasos().map((li) => li.textContent)).toEqual(INSCRIPCION)
    expect(actual()).toBe('Datos del contribuyente')
    // the other tabs wait for the inscription: no step to go to
    expect(navegables()).toEqual([])
    expect(instruccion()).toMatch(/^Paso 1: complete los datos del contribuyente/)
    // the tabs are still there
    expect(tab('Datos del contribuyente')).toHaveAttribute('aria-selected', 'true')
  })

  it('walks a new declaración with its tabs: the ubicación once the datos are in, and back', async () => {
    start('portal-tributario', '/contribuyentes/c1/declaraciones/nueva')
    await screen.findByRole('option', { name: 'COMPRA' })
    await waitFor(() => expect(actual()).toBe('Datos del predio'))
    expect(pasos().map((li) => li.textContent)).toEqual(DJ)
    // as its tab, the ubicación waits for the datos del predio
    expect(navegables()).toEqual([])
    expect(instruccion()).toMatch(/^Paso 1: /)

    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(actual()).toBe('Datos de la ubicación'))
    expect(tab('Datos de la ubicación')).toHaveAttribute('aria-selected', 'true')
    expect(instruccion()).toMatch(/^Paso 2: /)
    // back to the datos del predio from its step, as from its tab; the ubicación stays open
    expect(navegables()).toEqual(['Datos del predio'])
    await userEvent.click(within(galon()).getByRole('button', { name: 'Datos del predio' }))
    expect(tab('Datos del predio')).toHaveAttribute('aria-selected', 'true')
    expect(actual()).toBe('Datos del predio')
    expect(navegables()).toEqual(['Datos de la ubicación'])
  })

  it('moves the steps on with "Siguiente" in the declaración just presented', async () => {
    start('portal-tributario', '/declaraciones/d1?tab=transferentes&asistente=1')
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })).toBeInTheDocument()
    expect(actual()).toBe('Datos del transferente')
    expect(instruccion()).toMatch(/^Paso 3: /)
    // every tab is open: every other step can be gone to
    expect(navegables()).toEqual(DJ.filter((label) => label !== 'Datos del transferente'))

    await userEvent.click(within(header()).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(actual()).toBe('Características'))
    expect(tab('Características')).toHaveAttribute('aria-selected', 'true')
    expect(instruccion()).toMatch(/^Paso 4: /)

    // a step opens its tab, still in the wizard
    await userEvent.click(within(galon()).getByRole('button', { name: 'Otros frentes' }))
    expect(tab('Otros frentes')).toHaveAttribute('aria-selected', 'true')
    expect(actual()).toBe('Otros frentes')
    expect(instruccion()).toMatch(/^Paso 6: .*Terminar/)
    expect(new URLSearchParams(window.location.search).get('asistente')).toBe('1')
    expect(within(header()).getByRole('button', { name: 'Terminar' })).toBeInTheDocument()

    // "Terminar" ends the wizard: the steps go with it
    await userEvent.click(within(header()).getByRole('button', { name: 'Terminar' }))
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Pasos del trámite' })).not.toBeInTheDocument())
    expect(document.querySelector('[data-ui="barra-instruccion"]')).toBeNull()
    expect(tab('Otros frentes')).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the steps of the inscription on the ficha it goes on in, with the tabs that are open', async () => {
    start('portal-tributario', '/contribuyentes/c1?tab=domicilios&inscripcion=1')
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    await waitFor(() => expect(actual()).toBe('Domicilios'))
    expect(pasos().map((li) => li.textContent)).toEqual(INSCRIPCION)
    expect(instruccion()).toMatch(/^Paso 2: registre al menos un domicilio fiscal/)
    // no fiscal domicilio yet: only the datos, behind, can be gone to, as its tab
    expect(navegables()).toEqual(['Datos del contribuyente'])
    await userEvent.click(within(galon()).getByRole('button', { name: 'Datos del contribuyente' }))
    expect(tab('Datos del contribuyente')).toHaveAttribute('aria-selected', 'true')
    expect(actual()).toBe('Datos del contribuyente')
    expect(new URLSearchParams(window.location.search).get('inscripcion')).toBe('1')
  })

  it('has no steps in a ficha opened outside the inscription', async () => {
    start('portal-tributario', '/contribuyentes/c1?tab=domicilios')
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('portal-tributario'))
    expect(screen.queryByRole('list', { name: 'Pasos del trámite' })).not.toBeInTheDocument()
  })

  it('has no steps in a declaración opened outside the wizard', async () => {
    start('portal-tributario', '/declaraciones/d1')
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Pasos del trámite' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-ui="barra-instruccion"]')).toBeNull()
  })
})

describe('the wizards with light', () => {
  it.each([
    ['the inscription', '/contribuyentes/nuevo', 'Nuevo contribuyente'],
    ['a new declaración', '/contribuyentes/c1/declaraciones/nueva', 'Nueva declaración jurada predial'],
    ['the declaración just presented', '/declaraciones/d1?tab=transferentes&asistente=1', 'Declaración jurada predial - 39147'],
    ['the inscription on its ficha', '/contribuyentes/c1?tab=domicilios&inscripcion=1', 'QUISPE MAMANI JUAN']
  ])('draws %s with its tabs alone: no steps, no instruction', async (_, path, heading) => {
    start('light', path)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
    expect(screen.queryByRole('list', { name: 'Pasos del trámite' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-ui="pasos-galon"], [data-ui="barra-instruccion"]')).toBeNull()
  })
})
