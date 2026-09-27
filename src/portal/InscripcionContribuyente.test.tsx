import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// the srtm's inscription wizard (pp. 2-9): its tabs open step by step, and the contribuyente keeps one fiscal domicilio
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_contribuyente: 'PERSONA NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '43554564',
  nombre_completo: 'FLORES OTINIANO JUNIOR PAOLO',
  apellido_paterno: 'FLORES',
  apellido_materno: 'OTINIANO',
  nombres: 'JUNIOR PAOLO',
  codigo: '000013',
  domicilio_fiscal: null
}
const fiscal = {
  id: 'dm1',
  contribuyente: 'c1',
  tipo_domicilio: 'FISCAL',
  tipo_predio: 'PREDIO URBANO',
  ubigeo: '120302',
  departamento: 'JUNIN',
  provincia: 'CHANCHAMAYO',
  distrito: 'PERENE',
  via: 'MARGINAL',
  unidad_urbana: 'II MESETA',
  descripcion: 'MARGINAL, II MESETA, JUNIN-CHANCHAMAYO-PERENE',
  estado: 'ACTIVO'
}
const totales = { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      contribuyente: {
        tipo_documento: ['DNI', 'RUC'],
        tipo_contribuyente: ['PERSONA NATURAL', 'PERSONA JURIDICA'],
        motivo: ['INSCRIPCION'],
        medio_determinacion: ['DECLARACION JURADA'],
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        fuente_informacion: ['MANUAL'],
        estado_civil: ['SOLTERO', 'CASADO'],
        sexo: ['HOMBRE', 'MUJER']
      },
      domicilio: {
        tipo_domicilio: ['FISCAL', 'REAL'],
        tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
        tipo_via: ['AVENIDA', 'CALLE'],
        tipo_unidad_urbana: ['CENTRO POBLADO', 'CERCADO'],
        estado: ['ACTIVO', 'INACTIVO']
      }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  { path: '/srtm/vias', body: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } },
  { path: '/srtm/unidades-urbanas', body: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 0, totales } },
  { path: '/srtm/contribuyentes/c1/domicilios', body: [] },
  { path: '/srtm/contribuyentes/c1/relacionados', body: [] },
  { path: '/srtm/contribuyentes/c1/medios-contacto', body: [] },
  { path: '/srtm/contribuyentes/c1/sustentos', body: [] },
  { path: '/srtm/contribuyentes/c1/declaraciones', body: [] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

// the routes are read on every call: a test may put a newer answer in front of them
function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  const all = [...extra, ...routes]
  fetch = mockFetch(all)
  render(<PortalApp />)
  return all
}

const tab = (name: string) => screen.getByRole('tab', { name })
const WIZARD = ['Datos del contribuyente', 'Domicilios', 'Relacionados', 'Medios de contacto', 'Sustento', 'Predios', 'Declaraciones']
const enabled = () => WIZARD.filter((name) => !tab(name).hasAttribute('disabled'))

describe('inscripción de contribuyente', () => {
  it('moves on to the domicilios with the rest of the tabs waiting for the fiscal domicilio', async () => {
    start('/contribuyentes/nuevo', [{ method: 'POST', path: '/srtm/contribuyentes', status: 201, body: contribuyente }])
    await screen.findByRole('option', { name: 'PERSONA NATURAL' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de contribuyente/), 'PERSONA NATURAL')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'DNI')
    await userEvent.type(screen.getByLabelText(/N° documento/), '43554564')
    await userEvent.type(screen.getByLabelText(/Nombres/), 'JUNIOR PAOLO')
    await userEvent.selectOptions(screen.getByLabelText(/Estado civil/), 'SOLTERO')
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'HOMBRE')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('(*) Registrar al menos 1 domicilio fiscal')).toBeInTheDocument()
    expect(tab('Domicilios')).toHaveAttribute('aria-selected', 'true')
    expect(enabled()).toEqual(['Datos del contribuyente', 'Domicilios'])
  })

  it('opens Relacionados once the fiscal domicilio is registered, and then each tab the next', async () => {
    const all = start('/contribuyentes/c1?tab=domicilios&inscripcion=1', [
      { method: 'POST', path: '/srtm/contribuyentes/c1/domicilios', status: 201, body: fiscal }
    ])
    expect(await screen.findByText('(*) Registrar al menos 1 domicilio fiscal')).toBeInTheDocument()
    expect(enabled()).toEqual(['Datos del contribuyente', 'Domicilios'])

    await userEvent.click(screen.getByRole('button', { name: 'Agregar domicilio' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('option', { name: 'PERENE' })
    await userEvent.type(within(dialog).getByLabelText(/Descripción de la vía/), 'MARGINAL')
    await userEvent.type(within(dialog).getByLabelText(/Descripción unidad urbana/), 'II MESETA')
    all.unshift({ path: '/srtm/contribuyentes/c1/domicilios', body: [fiscal] })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))

    // as the srtm on p. 7: the fiscal domicilio opens Relacionados only
    await waitFor(() => expect(screen.queryByText('(*) Registrar al menos 1 domicilio fiscal')).not.toBeInTheDocument())
    expect(enabled()).toEqual(['Datos del contribuyente', 'Domicilios', 'Relacionados'])
    await userEvent.click(tab('Relacionados'))
    expect(enabled()).toEqual(['Datos del contribuyente', 'Domicilios', 'Relacionados', 'Medios de contacto'])
    await userEvent.click(tab('Medios de contacto'))
    expect(enabled()).toContain('Sustento')
    expect(enabled()).not.toContain('Predios')
    // the srtm's last step done (p. 9): rentas' own tabs too
    await userEvent.click(tab('Sustento'))
    expect(enabled()).toEqual(WIZARD)
    // the wizard stays one across its tabs
    expect(window.location.search).toContain('inscripcion=1')
  })

  it('keeps every tab of a contribuyente opened from the search', async () => {
    start('/contribuyentes/c1')
    expect(await screen.findByRole('heading', { name: 'FLORES OTINIANO JUNIOR PAOLO' })).toBeInTheDocument()
    expect(enabled()).toEqual(WIZARD)
  })

  it('makes the first domicilio the fiscal one, its tipo greyed', async () => {
    start('/contribuyentes/c1?tab=domicilios', [{ method: 'POST', path: '/srtm/contribuyentes/c1/domicilios', status: 201, body: fiscal }])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar domicilio' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/Tipo de domicilio/)).toBeDisabled()
    expect(within(dialog).getByLabelText(/Tipo de domicilio/)).toHaveValue('FISCAL')
    await within(dialog).findByRole('option', { name: 'PERENE' })
    await userEvent.type(within(dialog).getByLabelText(/Descripción de la vía/), 'MARGINAL')
    await userEvent.type(within(dialog).getByLabelText(/Descripción unidad urbana/), 'II MESETA')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await waitFor(() => {
      const call = fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/domicilios')
      expect(call).toBeDefined()
      return call!
    })
    expect(post.body).toMatchObject({ tipo_domicilio: 'FISCAL', estado: 'ACTIVO' })
  })

  it('keeps the only fiscal domicilio fiscal and there, while another one takes any tipo', async () => {
    start('/contribuyentes/c1?tab=domicilios', [{ path: '/srtm/contribuyentes/c1/domicilios', body: [fiscal] }])
    expect(await screen.findByText(/MARGINAL, II MESETA/)).toBeInTheDocument()
    expect(screen.queryByText('(*) Registrar al menos 1 domicilio fiscal')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('row', { name: /MARGINAL, II MESETA/ }))
    expect(screen.getByRole('button', { name: 'Eliminar domicilio' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText(/Tipo de domicilio/)).toBeDisabled()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Agregar domicilio' }))
    const tipo = within(await screen.findByRole('dialog')).getByLabelText(/Tipo de domicilio/)
    expect(tipo).toBeEnabled()
    expect(tipo).toHaveValue('REAL')
  })

  it('sends the inscription once, however fast Siguiente is pressed', async () => {
    start('/contribuyentes/nuevo', [{ method: 'POST', path: '/srtm/contribuyentes', status: 201, body: contribuyente }])
    // the inscription waits until the test lets it go
    const mocked = globalThis.fetch
    let posts = 0
    let release = () => {}
    globalThis.fetch = (input, init) => {
      if (init?.method !== 'POST') return mocked(input, init)
      posts += 1
      return new Promise<Response>((resolve) => (release = () => resolve(mocked(input, init))))
    }
    await screen.findByRole('option', { name: 'PERSONA NATURAL' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de contribuyente/), 'PERSONA NATURAL')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'DNI')
    await userEvent.type(screen.getByLabelText(/N° documento/), '43554564')
    await userEvent.type(screen.getByLabelText(/Nombres/), 'JUNIOR PAOLO')
    await userEvent.selectOptions(screen.getByLabelText(/Estado civil/), 'SOLTERO')
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'HOMBRE')
    await userEvent.dblClick(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Guardando…' }))
    expect(posts).toBe(1)
    release()
    expect(await screen.findByText('(*) Registrar al menos 1 domicilio fiscal')).toBeInTheDocument()
    expect(posts).toBe(1)
  })
})
