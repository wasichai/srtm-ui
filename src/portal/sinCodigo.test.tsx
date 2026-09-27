import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { AUTO, SIN_CODIGO, SIN_FECHA, vacioDe, type FieldSpec } from './forms/specs'
import { PortalApp } from './PortalApp'

// the backend's codes and numbers: "(AUTOGENERADO)" only before the record exists. one imported from the padrón,
// stored without them, never gets them: "SIN CÓDIGO (padrón)" (issue wasichai/srtm-backend#9)

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

// as the padrón loaded them: no code, number or fecha del registro
const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '20529936',
  nombre_completo: 'QUISPE MAMANI JUAN',
  apellido_paterno: 'QUISPE',
  nombres: 'JUAN',
  codigo: null,
  numero_declaracion: null,
  fecha_registro: null
}
const predio = { id: 'p1', codigo: '01-01-0001', numero_registro: null, condicion: 'URBANO', direccion: 'JR. LIMA 123' }
const declaracion = { id: 'd1', contribuyente: 'c1', predio: 'p1', anio: year, numero_declaracion: null, secuencia_uso: '001' }
const dj = { declaracion, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' }
const totales = { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 }
// saved before relacionados were coded
const relacionado = {
  id: 'r1',
  contribuyente: 'c1',
  codigo: null,
  tipo_relacionado: 'CONYUGE',
  tipo_documento: 'DNI',
  numero_documento: '43434352',
  nombres: 'DUBERLI',
  estado: 'ACTIVO'
}

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/ubigeos', body: [] },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/contribuyentes/c1/relacionados', body: [relacionado] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: '/srtm/declaraciones/d1/transferentes', body: [] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

function start(path: string) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

// a read-only field's value in the open tab of a ficha (label over value)
const panel = () => within(screen.getByRole('tabpanel'))
const leido = (label: string) => panel().getByText(label, { selector: 'dt' }).nextElementSibling

describe('placeholders of the backend codes', () => {
  it('promise a code only while the record is new', () => {
    const codigo: FieldSpec = { name: 'codigo', label: 'Código', readOnly: true, placeholder: AUTO }
    expect(vacioDe(codigo, {}, false)).toBe(AUTO)
    expect(vacioDe(codigo, {}, true)).toBe(SIN_CODIGO)
    expect(vacioDe({ ...codigo, kind: 'date' }, {}, true)).toBe(SIN_FECHA)
    // any other placeholder is just that
    expect(vacioDe({ name: 'observacion', label: 'Observación', placeholder: 'OBSERVACIÓN' }, {}, true)).toBe('OBSERVACIÓN')
    // a field of another record says whether that one exists
    const deOtro: FieldSpec = { ...codigo, existe: (v) => Boolean(v.codigo_predio) }
    expect(vacioDe(deOtro, { codigo_predio: '01-01-0001' }, false)).toBe(SIN_CODIGO)
    expect(vacioDe(deOtro, { codigo_predio: '' }, true)).toBe(AUTO)
  })

  it('shows an imported contribuyente without code, number or fecha del registro, read and edited', async () => {
    start('/contribuyentes/c1')
    expect(await screen.findByText('Código de contribuyente', { selector: 'dt' })).toBeInTheDocument()
    expect(leido('Código de contribuyente')).toHaveTextContent(SIN_CODIGO)
    expect(leido('Número de declaración')).toHaveTextContent(SIN_CODIGO)
    expect(leido('Fecha del registro')).toHaveTextContent(SIN_FECHA)

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Código de contribuyente')).toHaveAttribute('placeholder', SIN_CODIGO)
    expect(screen.getByLabelText('Número de declaración')).toHaveAttribute('placeholder', SIN_CODIGO)
    expect(screen.getByLabelText('Fecha del registro')).toHaveAttribute('placeholder', SIN_FECHA)
  })

  it('shows an imported declaracion and its predio without numbers, read and edited', async () => {
    start('/declaraciones/d1')
    expect(await screen.findByText('Número de declaración jurada', { selector: 'dt' })).toBeInTheDocument()
    expect(leido('Número de declaración jurada')).toHaveTextContent(SIN_CODIGO)
    expect(leido('Número de registro de predio')).toHaveTextContent(SIN_CODIGO)

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Número de declaración jurada')).toHaveAttribute('placeholder', SIN_CODIGO)
    expect(screen.getByLabelText('Número de registro de predio')).toHaveAttribute('placeholder', SIN_CODIGO)
    expect(screen.getByLabelText('Código de predio')).toHaveValue('01-01-0001')

    // one form at a time: both tabs' inputs carry the same ids
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Datos de la ubicación' }))
    expect(await panel().findByText('Número de registro de predio', { selector: 'dt' })).toBeInTheDocument()
    expect(leido('Número de registro de predio')).toHaveTextContent(SIN_CODIGO)
    await userEvent.click(panel().getByRole('button', { name: 'Editar' }))
    expect(panel().getByLabelText('Número de registro de predio')).toHaveAttribute('placeholder', SIN_CODIGO)
  })

  it("promises a new declaracion's number, not a number to a predio of the padron", async () => {
    start(`/declaraciones/nueva?predio=p1`)
    expect(await screen.findByRole('heading', { name: 'Nueva declaración jurada predial' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Código de predio')).toHaveValue('01-01-0001')
    expect(screen.getByLabelText('Número de declaración jurada')).toHaveAttribute('placeholder', AUTO)
    expect(screen.getByLabelText('Número de registro de predio')).toHaveAttribute('placeholder', SIN_CODIGO)
  })

  it('shows a relacionado saved without code as such, and promises one to a new one', async () => {
    start('/contribuyentes/c1?tab=relacionados')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar relacionado 1' }))
    const editado = await screen.findByRole('dialog')
    expect(within(editado).getByLabelText('Código del relacionado')).toHaveAttribute('placeholder', SIN_CODIGO)
    await userEvent.click(within(editado).getByRole('button', { name: 'Cancelar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Agregar relacionado' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Código del relacionado')).toHaveAttribute('placeholder', AUTO)
  })
})
