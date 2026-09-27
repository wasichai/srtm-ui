import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// PIDE RENIEC (pages 3, 8 and 15): leaving the DNI of a contribuyente, a relacionado or a transferente asks the
// backend for RENIEC's names. with them, apellidos and nombres are filled and greyed, with fuente PIDE RENIEC (greyed);
// without them (404: no convenio, unknown DNI, a failure) they are typed, with fuente MANUAL

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const DNI = '43554564'
const reniec = {
  tipo_documento: 'DNI',
  numero_documento: DNI,
  apellido_paterno: 'FLORES',
  apellido_materno: 'OTINIANO',
  nombres: 'JUNIOR PAOLO',
  estado_civil: 'SOLTERO',
  direccion: 'JR. LIMA 123',
  ubigeo: 'JUNIN/CHANCHAMAYO/PERENE',
  fuente_informacion: 'PIDE RENIEC'
}
const consulta = (numero: string) => `/srtm/documentos/DNI/${numero}`

const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_documento: 'DNI',
  numero_documento: DNI,
  nombre_completo: 'FLORES OTINIANO JUNIOR PAOLO',
  apellido_paterno: 'FLORES',
  apellido_materno: 'OTINIANO',
  nombres: 'JUNIOR PAOLO',
  razon_social: null,
  codigo: '000012',
  tipo_contribuyente: 'PERSONA NATURAL',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24',
  fuente_informacion: 'PIDE RENIEC',
  estado_civil: 'SOLTERO',
  sexo: 'HOMBRE'
}
const predio = { id: 'p1', codigo: '01-01-0001', condicion: 'URBANO', direccion: 'JR. LIMA 123', numero_registro: 5243 }
const dj = {
  declaracion: { id: 'd1', contribuyente: 'c1', predio: 'p1', anio: year, numero_declaracion: 39147, condicion_propiedad: 'PROPIETARIO UNICO' },
  predio,
  contribuyente,
  actualizado: '2026-09-25T14:03:00Z'
}
const personas = { tipo_documento: ['SIN DOCUMENTO', 'DNI', 'RUC'], fuente_informacion: ['MANUAL', 'PIDE RENIEC', 'PIDE SUNAT'] }
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      contribuyente: {
        ...personas,
        tipo_contribuyente: ['PERSONA NATURAL', 'PERSONA JURIDICA'],
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        estado_civil: ['SOLTERO', 'CASADO'],
        sexo: ['HOMBRE', 'MUJER']
      },
      relacionado: { ...personas, tipo_relacionado: ['CONYUGE', 'APODERADO'], estado: ['ACTIVO', 'INACTIVO'] },
      transferente: { ...personas, estado_civil: ['SOLTERO', 'CASADO'], sexo: ['HOMBRE', 'MUJER'], estado: ['ACTIVO', 'INACTIVO'] }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  { path: '/srtm/vias', body: page([]) },
  { path: '/srtm/unidades-urbanas', body: page([]) },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales: { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 } } },
  { path: '/srtm/contribuyentes/c1/domicilios', body: [] },
  { path: '/srtm/contribuyentes/c1/relacionados', body: [] },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: '/srtm/declaraciones/d1/transferentes', body: [] },
  { path: consulta(DNI), body: reniec }
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

const consultas = () => fetch!.calls.filter((c) => c.path.startsWith('/srtm/documentos/'))
const posted = (path: string) =>
  waitFor(() => {
    const call = fetch!.calls.find((c) => c.method === 'POST' && c.path === path)
    expect(call).toBeDefined()
    return call!
  })

// the names and the fuente, as the clerk sees them: greyed or not, and their values
function nombres(root: HTMLElement = document.body) {
  const field = (label: RegExp) => within(root).getByLabelText(label) as HTMLInputElement | HTMLSelectElement
  return [field(/Apellido paterno/), field(/Apellido materno/), field(/^Nombres/), field(/Fuente información/)].map((f) => ({
    value: f.value,
    disabled: f.disabled
  }))
}
const deReniec = [
  { value: 'FLORES', disabled: true },
  { value: 'OTINIANO', disabled: true },
  { value: 'JUNIOR PAOLO', disabled: true },
  { value: 'PIDE RENIEC', disabled: true }
]

// leaves the N° documento with this number
async function dni(numero: string, root: HTMLElement = document.body) {
  const input = within(root).getByLabelText(/N° documento/)
  await userEvent.clear(input)
  await userEvent.type(input, numero)
  await userEvent.tab()
}

async function nuevoContribuyente(extra: MockRoute[] = []) {
  start('/contribuyentes/nuevo', extra)
  await screen.findByRole('option', { name: 'PERSONA NATURAL' })
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de contribuyente/), 'PERSONA NATURAL')
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'DNI')
}

describe('PIDE RENIEC in the contribuyente', () => {
  it('fills and greys the names with fuente PIDE RENIEC, and sends them so', async () => {
    const inscrito = { ...contribuyente, id: 'c9' }
    await nuevoContribuyente([
      { method: 'POST', path: '/srtm/contribuyentes', status: 201, body: inscrito },
      {
        path: '/srtm/contribuyentes/c9',
        body: { contribuyente: inscrito, anio: year, predios: 0, totales: { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 } }
      },
      { path: '/srtm/contribuyentes/c9/domicilios', body: [] }
    ])
    await dni(DNI)

    await waitFor(() => expect(nombres()).toEqual(deReniec))
    expect(consultas().map((c) => c.path)).toEqual([consulta(DNI)])
    await userEvent.selectOptions(screen.getByLabelText(/Estado civil/), 'SOLTERO')
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'HOMBRE')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await posted('/srtm/contribuyentes')
    expect(post.body).toMatchObject({
      tipo_documento: 'DNI',
      numero_documento: DNI,
      apellido_paterno: 'FLORES',
      apellido_materno: 'OTINIANO',
      nombres: 'JUNIOR PAOLO',
      fuente_informacion: 'PIDE RENIEC'
    })
  })

  it('without an answer leaves the names to type, with fuente MANUAL', async () => {
    await nuevoContribuyente()
    await dni('43554565')

    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(nombres()).toEqual([
      { value: '', disabled: false },
      { value: '', disabled: false },
      { value: '', disabled: false },
      { value: 'MANUAL', disabled: false }
    ])
    // the same number again is not asked twice: every consulta costs
    await userEvent.click(screen.getByLabelText(/N° documento/))
    await userEvent.tab()
    expect(consultas()).toHaveLength(1)
  })

  it('asks nothing of a number that is no DNI', async () => {
    await nuevoContribuyente()
    await dni('4355456')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'RUC')
    await dni('20131312955')
    expect(consultas()).toHaveLength(0)
    expect(screen.getByLabelText(/Fuente información/)).toHaveValue('MANUAL')
  })

  it('frees the names once the DNI changes', async () => {
    await nuevoContribuyente()
    await dni(DNI)
    await waitFor(() => expect(nombres()).toEqual(deReniec))

    await userEvent.type(screen.getByLabelText(/N° documento/), '9')
    expect(nombres()).toEqual([
      { value: 'FLORES', disabled: false },
      { value: 'OTINIANO', disabled: false },
      { value: 'JUNIOR PAOLO', disabled: false },
      { value: 'MANUAL', disabled: false }
    ])
    // back to a DNI RENIEC knows: filled and greyed again
    await dni(DNI)
    await waitFor(() => expect(nombres()).toEqual(deReniec))
  })

  it('drops an answer that comes after the DNI changed', async () => {
    await nuevoContribuyente()
    // RENIEC answers only once let go
    let soltar: () => void = () => {}
    const espera = new Promise<void>((resolve) => (soltar = resolve))
    const mock = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/srtm/documentos/')) await espera
      return mock(input, init)
    }
    await dni(DNI)
    await userEvent.type(screen.getByLabelText(/N° documento/), '{Backspace}7')
    soltar()

    await waitFor(() => expect(consultas()).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(nombres()).toEqual([
      { value: '', disabled: false },
      { value: '', disabled: false },
      { value: '', disabled: false },
      { value: 'MANUAL', disabled: false }
    ])
  })

  it('asks RENIEC again when PIDE RENIEC is chosen by hand, and goes back to MANUAL without an answer', async () => {
    await nuevoContribuyente()
    await dni('43554565')
    await waitFor(() => expect(consultas()).toHaveLength(1))
    await userEvent.selectOptions(screen.getByLabelText(/Fuente información/), 'PIDE RENIEC')
    await waitFor(() => expect(consultas()).toHaveLength(2))
    await waitFor(() => expect(screen.getByLabelText(/Fuente información/)).toHaveValue('MANUAL'))
    expect(screen.getByLabelText(/Fuente información/)).toBeEnabled()
    expect(screen.getByLabelText(/Apellido paterno/)).toBeEnabled()

    await dni(DNI)
    await waitFor(() => expect(nombres()).toEqual(deReniec))
  })

  it('keeps greyed the names a saved contribuyente took from RENIEC, and does not ask again for its DNI', async () => {
    start('/contribuyentes/c1')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    await screen.findByRole('option', { name: 'PERSONA NATURAL' })
    expect(nombres()).toEqual(deReniec)

    await userEvent.click(screen.getByLabelText(/N° documento/))
    await userEvent.tab()
    expect(consultas()).toHaveLength(0)
  })
})

describe('PIDE RENIEC in relacionados and transferentes', () => {
  it('fills and greys the names of a relacionado', async () => {
    const path = '/srtm/contribuyentes/c1/relacionados'
    start('/contribuyentes/c1?tab=relacionados', [{ method: 'POST', path, status: 201, body: { id: 'r1' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar relacionado' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('option', { name: 'CONYUGE' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de relacionado/), 'CONYUGE')
    await dni(DNI, dialog)

    await waitFor(() => expect(nombres(dialog)).toEqual(deReniec))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await posted(path)
    expect(post.body).toMatchObject({ numero_documento: DNI, apellido_paterno: 'FLORES', nombres: 'JUNIOR PAOLO', fuente_informacion: 'PIDE RENIEC' })
  })

  it('fills and greys the names of a transferente, and without an answer leaves them to type', async () => {
    const path = '/srtm/declaraciones/d1/transferentes'
    start('/declaraciones/d1?tab=transferentes', [{ method: 'POST', path, status: 201, body: { id: 't1' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar transferente' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('option', { name: 'PERENE' })
    await dni('43554565', dialog)
    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(within(dialog).getByLabelText(/Apellido paterno/)).toBeEnabled()
    expect(within(dialog).getByLabelText(/Fuente información/)).toHaveValue('MANUAL')

    await dni(DNI, dialog)
    await waitFor(() => expect(nombres(dialog)).toEqual(deReniec))
    await userEvent.type(within(dialog).getByLabelText(/% de propiedad transferido/), '50')
    await userEvent.type(within(dialog).getByLabelText(/Descripción domicilio/), 'JR. LIMA 123')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await posted(path)
    expect(post.body).toMatchObject({ numero_documento: DNI, apellido_materno: 'OTINIANO', fuente_informacion: 'PIDE RENIEC' })
  })
})
