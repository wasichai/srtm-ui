import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { errorDocumento } from './forms/documento'

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

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
  codigo: '000012',
  tipo_contribuyente: 'PERSONA NATURAL',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24',
  fuente_informacion: 'MANUAL',
  estado_civil: 'SOLTERO',
  sexo: 'HOMBRE'
}
const totales = { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 }
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      contribuyente: {
        tipo_documento: ['SIN DOCUMENTO', 'DNI', 'CARNET DE EXTRANJERIA', 'RUC'],
        tipo_contribuyente: ['PERSONA NATURAL', 'PERSONA JURIDICA'],
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        fuente_informacion: ['MANUAL', 'PIDE RENIEC'],
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
  { path: '/srtm/vias', body: page([]) },
  { path: '/srtm/unidades-urbanas', body: page([]) },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 0, totales } },
  { path: '/srtm/contribuyentes/c1/domicilios', body: [] }
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

// what the wizard asks of a persona natural, besides the document
async function datosPersonales() {
  await screen.findByRole('option', { name: 'PERSONA NATURAL' })
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de contribuyente/), 'PERSONA NATURAL')
  await userEvent.type(screen.getByLabelText('Apellido paterno'), 'FLORES')
  await userEvent.type(screen.getByLabelText(/Nombres/), 'JUNIOR PAOLO')
  await userEvent.selectOptions(screen.getByLabelText(/Estado civil/), 'SOLTERO')
  await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'HOMBRE')
}

// a field's label, with its " *" when it is required
const etiqueta = (field: string, root: ParentNode = document) => root.querySelector(`#field-${field}-label`)!.textContent

const inscripcion = () => fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes')

// the same cases are in srtm-backend (DocumentoTest): both sides must accept and refuse the same numbers
describe('errorDocumento', () => {
  it('takes a dni of eight digits', () => {
    expect(errorDocumento('DNI', '43554564')).toBeNull()
    expect(errorDocumento('DNI', ' 43554564 ')).toBeNull()
    expect(errorDocumento('DNI', '4355456')).toBe('El DNI tiene 8 dígitos')
    expect(errorDocumento('DNI', '435545641')).toBe('El DNI tiene 8 dígitos')
    expect(errorDocumento('DNI', '4355456A')).toBe('El DNI tiene 8 dígitos')
    expect(errorDocumento('DNI', null)).toBe('Este dato es obligatorio')
    expect(errorDocumento('DNI', '  ')).toBe('Este dato es obligatorio')
  })

  it("takes a ruc of eleven digits with sunat's prefix and check digit", () => {
    // sunat's own ruc, and a persona natural's (10 + dni + check digit)
    expect(errorDocumento('RUC', '20131312955')).toBeNull()
    expect(errorDocumento('RUC', '10460278975')).toBeNull()
    expect(errorDocumento('RUC', '20131312954')).toBe('El dígito verificador del RUC no es válido')
    expect(errorDocumento('RUC', '30131312955')).toBe('El RUC tiene 11 dígitos y empieza con 10, 15, 16, 17 o 20')
    expect(errorDocumento('RUC', '2013131295')).toBe('El RUC tiene 11 dígitos y empieza con 10, 15, 16, 17 o 20')
    expect(errorDocumento('RUC', null)).toBe('Este dato es obligatorio')
  })

  it('takes any other document as up to twelve letters or digits', () => {
    expect(errorDocumento('CARNET DE EXTRANJERIA', '001234567')).toBeNull()
    expect(errorDocumento('PASAPORTE', 'AB1234567890')).toBeNull()
    expect(errorDocumento('SUCESION', 'S123')).toBeNull()
    expect(errorDocumento('PASAPORTE', 'AB12345678901')).toBe('Hasta 12 letras o dígitos')
    expect(errorDocumento('CARNET DE EXTRANJERIA', 'AB-123')).toBe('Hasta 12 letras o dígitos')
    expect(errorDocumento('PASAPORTE', '')).toBe('Este dato es obligatorio')
  })

  it('asks no number of sin documento, nor before a tipo is chosen', () => {
    expect(errorDocumento('SIN DOCUMENTO', null)).toBeNull()
    expect(errorDocumento('SIN DOCUMENTO', 'cualquier cosa')).toBeNull()
    expect(errorDocumento(null, 'x')).toBeNull()
    expect(errorDocumento('', 'x')).toBeNull()
  })
})

describe('the document of a new contribuyente', () => {
  it('starts at SELECCIONAR, with the number greyed until a tipo is chosen', async () => {
    start('/contribuyentes/nuevo')
    expect(await screen.findByLabelText(/Tipo de documento/)).toHaveValue('')
    expect(screen.getByLabelText(/N° documento/)).toBeDisabled()
    expect(etiqueta('numero_documento')).toBe('N° documento')

    await screen.findByRole('option', { name: 'DNI' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'DNI')
    expect(screen.getByLabelText(/N° documento/)).toBeEnabled()
    expect(etiqueta('numero_documento')).toBe('N° documento *')
  })

  it('refuses a dni of seven digits', async () => {
    start('/contribuyentes/nuevo')
    await datosPersonales()
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'DNI')
    await userEvent.type(screen.getByLabelText(/N° documento/), '4355456')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('El DNI tiene 8 dígitos')).toBeInTheDocument()
    expect(screen.getByLabelText(/N° documento/)).toHaveAttribute('aria-invalid', 'true')
    expect(inscripcion()).toBeUndefined()
  })

  it('inscribes SIN DOCUMENTO without a number', async () => {
    const inscrito = { ...contribuyente, id: 'c9', tipo_documento: 'SIN DOCUMENTO', numero_documento: null }
    start('/contribuyentes/nuevo', [
      { method: 'POST', path: '/srtm/contribuyentes', status: 201, body: inscrito },
      { path: '/srtm/contribuyentes/c9', body: { contribuyente: inscrito, anio: year, predios: 0, totales } },
      { path: '/srtm/contribuyentes/c9/domicilios', body: [] }
    ])
    await datosPersonales()
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'SIN DOCUMENTO')
    expect(screen.getByLabelText(/N° documento/)).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await waitFor(() => inscripcion()!)
    expect(post.body).toMatchObject({ tipo_documento: 'SIN DOCUMENTO', numero_documento: null })
  })
})

describe('the vía and unidad urbana of a domicilio', () => {
  const grabado = () => fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/domicilios')

  async function nuevoDomicilio() {
    start('/contribuyentes/c1?tab=domicilios', [
      { method: 'POST', path: '/srtm/contribuyentes/c1/domicilios', status: 201, body: { id: 'd1', estado: 'ACTIVO' } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar domicilio' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('option', { name: 'PERENE' })
    return dialog
  }

  it('are not asked without their tipo: a "Mz/Lt" address saves', async () => {
    const dialog = await nuevoDomicilio()
    expect(etiqueta('via', dialog)).toBe('Descripción de la vía')
    expect(etiqueta('unidad_urbana', dialog)).toBe('Descripción unidad urbana')
    await userEvent.type(within(dialog).getByLabelText('Manzana'), 'C')
    await userEvent.type(within(dialog).getByLabelText('Lote'), '19')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))

    const post = await waitFor(() => grabado()!)
    expect(post.body).toMatchObject({ tipo_via: null, via: null, tipo_unidad_urbana: null, unidad_urbana: null, manzana: 'C', lote: '19' })
  })

  it('are asked once their tipo is chosen', async () => {
    const dialog = await nuevoDomicilio()
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo de vía'), 'AVENIDA')
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo unidad urbana'), 'CERCADO')
    expect(etiqueta('via', dialog)).toBe('Descripción de la vía *')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))

    expect(await within(dialog).findByLabelText(/Descripción de la vía/)).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByLabelText(/Descripción unidad urbana/)).toHaveAttribute('aria-invalid', 'true')
    expect(grabado()).toBeUndefined()
  })
})
