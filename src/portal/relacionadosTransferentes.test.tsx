import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// relacionados (page 8) and transferentes (page 15): the backend's code, the razón social of a company (RUC) instead
// of its names, the fuente de información required and the fecha de fallecimiento greyed

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
  codigo: '000012',
  tipo_contribuyente: 'PERSONA NATURAL',
  fuente_informacion: 'MANUAL'
}
const persona = {
  tipo_documento: 'DNI',
  numero_documento: '43434352',
  fuente_informacion: 'MANUAL',
  apellido_paterno: 'NEIRA',
  apellido_materno: 'CAMPOS',
  nombres: 'DUBERLI',
  razon_social: null,
  fecha_fallecimiento: null,
  estado: 'ACTIVO'
}
const empresa = {
  tipo_documento: 'RUC',
  numero_documento: '20123456786',
  fuente_informacion: 'PIDE SUNAT',
  apellido_paterno: null,
  apellido_materno: null,
  nombres: null,
  razon_social: 'INVERSIONES PERENE SAC',
  fecha_fallecimiento: null,
  estado: 'ACTIVO'
}
const relacionados = [
  { ...persona, id: 'r1', contribuyente: 'c1', codigo: '001', tipo_relacionado: 'CONYUGE' },
  { ...empresa, id: 'r2', contribuyente: 'c1', codigo: '002', tipo_relacionado: 'APODERADO' },
  // before razón social: a RUC one saved with names, and no code
  {
    ...persona,
    id: 'r3',
    contribuyente: 'c1',
    codigo: null,
    tipo_relacionado: 'APODERADO',
    tipo_documento: 'RUC',
    apellido_paterno: null,
    apellido_materno: null,
    nombres: 'ANTIGUA SAC'
  }
]
const domicilioTransferente = { departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE', ubigeo: '120302', descripcion_domicilio: 'JR. LIMA 123' }
const transferentes = [
  { ...persona, ...domicilioTransferente, id: 't1', declaracion: 'd1', codigo: '001', porcentaje_transferido: 50 },
  { ...empresa, ...domicilioTransferente, id: 't2', declaracion: 'd1', codigo: '002', porcentaje_transferido: 50 }
]
const predio = { id: 'p1', codigo: '01-01-0001', condicion: 'URBANO', direccion: 'JR. LIMA 123', numero_registro: 5243 }
const dj = {
  declaracion: { id: 'd1', contribuyente: 'c1', predio: 'p1', anio: year, numero_declaracion: 39147, condicion_propiedad: 'PROPIETARIO UNICO' },
  predio,
  contribuyente,
  actualizado: '2026-09-25T14:03:00Z'
}
const personas = { tipo_documento: ['DNI', 'RUC'], fuente_informacion: ['MANUAL', 'PIDE RENIEC', 'PIDE SUNAT'], estado: ['ACTIVO', 'INACTIVO'] }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      relacionado: { ...personas, tipo_relacionado: ['CONYUGE', 'APODERADO'] },
      transferente: { ...personas, estado_civil: ['SOLTERO', 'CASADO'], sexo: ['HOMBRE', 'MUJER'] }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales: { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 } } },
  { path: '/srtm/contribuyentes/c1/relacionados', body: relacionados },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: '/srtm/declaraciones/d1/transferentes', body: transferentes }
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

const posted = (path: string) => waitFor(() => fetch!.calls.find((c) => c.method === 'POST' && c.path === path)!)
const posts = (path: string) => fetch!.calls.filter((c) => c.method === 'POST' && c.path === path)

describe('relacionados y transferentes', () => {
  it('lists relacionados by their stored code, and by name or razon social', async () => {
    start('/contribuyentes/c1?tab=relacionados')
    expect(await screen.findByText('INVERSIONES PERENE SAC')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Código' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Apellidos y nombres / Razón social' })).toBeInTheDocument()
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).getByText('001')).toBeInTheDocument()
    expect(within(filas[0]).getByText('NEIRA CAMPOS DUBERLI')).toBeInTheDocument()
    expect(within(filas[1]).getByText('002')).toBeInTheDocument()
    expect(within(filas[1]).getByText('INVERSIONES PERENE SAC')).toBeInTheDocument()
    // saved before the razón social existed: its names still name it
    expect(within(filas[2]).getByText('ANTIGUA SAC')).toBeInTheDocument()
  })

  it('adds a relacionado with RUC by its razon social, with its fuente required and no fecha de fallecimiento to type', async () => {
    const path = '/srtm/contribuyentes/c1/relacionados'
    start('/contribuyentes/c1?tab=relacionados', [{ method: 'POST', path, status: 201, body: { id: 'r4' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar relacionado' }))
    const dialog = await screen.findByRole('dialog')
    const codigo = within(dialog).getByLabelText('Código del relacionado')
    expect(codigo).toBeDisabled()
    expect(codigo).toHaveAttribute('placeholder', '(AUTOGENERADO)')
    expect(within(dialog).getByLabelText('Fecha de fallecimiento')).toBeDisabled()

    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de relacionado/), 'APODERADO')
    expect(within(dialog).getByLabelText(/Nombres/)).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de documento/), 'RUC')
    expect(within(dialog).queryByLabelText(/Nombres/)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Apellido paterno/)).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/N° documento/), '20123456786')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Fuente información/), '')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(await within(dialog).findAllByText('Este dato es obligatorio')).toHaveLength(2)
    expect(posts(path)).toHaveLength(0)

    await userEvent.type(within(dialog).getByLabelText(/Razón social/), 'INVERSIONES PERENE SAC')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Fuente información/), 'PIDE SUNAT')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await posted(path)
    expect(post.body).toMatchObject({
      codigo: null,
      tipo_relacionado: 'APODERADO',
      tipo_documento: 'RUC',
      numero_documento: '20123456786',
      fuente_informacion: 'PIDE SUNAT',
      razon_social: 'INVERSIONES PERENE SAC',
      fecha_fallecimiento: null
    })
  })

  it('checks the document number by its tipo, as the contribuyente does', async () => {
    const path = '/srtm/contribuyentes/c1/relacionados'
    start('/contribuyentes/c1?tab=relacionados', [{ method: 'POST', path, status: 201, body: { id: 'r4' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar relacionado' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de relacionado/), 'CONYUGE')
    await userEvent.type(within(dialog).getByLabelText(/N° documento/), '4343435')
    await userEvent.type(within(dialog).getByLabelText(/Nombres/), 'DUBERLI')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(await within(dialog).findByText('El DNI tiene 8 dígitos')).toBeInTheDocument()
    expect(posts(path)).toHaveLength(0)

    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de documento/), 'RUC')
    await userEvent.clear(within(dialog).getByLabelText(/N° documento/))
    await userEvent.type(within(dialog).getByLabelText(/N° documento/), '20123456789')
    await userEvent.type(within(dialog).getByLabelText(/Razón social/), 'INVERSIONES PERENE SAC')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(await within(dialog).findByText('El dígito verificador del RUC no es válido')).toBeInTheDocument()
    expect(posts(path)).toHaveLength(0)
  })

  it('lists transferentes by their stored code, and by name or razon social', async () => {
    start('/declaraciones/d1?tab=transferentes')
    expect(await screen.findByText('INVERSIONES PERENE SAC')).toBeInTheDocument()
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).getByText('001')).toBeInTheDocument()
    expect(within(filas[0]).getByText('NEIRA CAMPOS DUBERLI')).toBeInTheDocument()
    expect(within(filas[1]).getByText('002')).toBeInTheDocument()
    expect(within(filas[1]).getByText('INVERSIONES PERENE SAC')).toBeInTheDocument()
  })

  it('adds a transferente with RUC and its razon social', async () => {
    const path = '/srtm/declaraciones/d1/transferentes'
    start('/declaraciones/d1?tab=transferentes', [{ method: 'POST', path, status: 201, body: { id: 't3' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar transferente' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('option', { name: 'PERENE' })
    const codigo = within(dialog).getByLabelText('Código del transferente')
    expect(codigo).toBeDisabled()
    expect(codigo).toHaveAttribute('placeholder', '(AUTOGENERADO)')
    expect(within(dialog).getByLabelText('Fecha de fallecimiento')).toBeDisabled()

    await userEvent.type(within(dialog).getByLabelText(/% de propiedad transferido/), '50')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de documento/), 'RUC')
    expect(within(dialog).queryByLabelText(/Apellido paterno/)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Nombres/)).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/N° documento/), '20123456786')
    await userEvent.type(within(dialog).getByLabelText(/Descripción domicilio/), 'AV. PERU 456')
    // the razón social is what a company is named by: no save without it
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(await within(dialog).findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(posts(path)).toHaveLength(0)

    await userEvent.type(within(dialog).getByLabelText(/Razón social/), 'INVERSIONES PERENE SAC')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await posted(path)
    expect(post.body).toMatchObject({
      codigo: null,
      porcentaje_transferido: 50,
      tipo_documento: 'RUC',
      numero_documento: '20123456786',
      fuente_informacion: 'MANUAL',
      razon_social: 'INVERSIONES PERENE SAC',
      distrito: 'PERENE',
      descripcion_domicilio: 'AV. PERU 456'
    })
  })
})
