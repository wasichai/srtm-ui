import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// the srtm's lists (pp. 4, 7, 9, 17, 20): "+", pencil and bin over the table act on the selected row, and the
// código / número column is the one the backend stored, not the row's position

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_contribuyente: 'PERSONA NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '43554564',
  nombre_completo: 'FLORES OTINIANO JUNIOR PAOLO',
  codigo: '000013',
  domicilio_fiscal: 'AV. MARGINAL 234'
}
const lugar = { tipo_predio: 'PREDIO URBANO', ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }
// 001 was removed: the codes left keep their numbers
const fiscal = {
  ...lugar,
  id: 'dm2',
  contribuyente: 'c1',
  codigo: '002',
  tipo_domicilio: 'FISCAL',
  via: 'MARGINAL',
  descripcion: 'AV. MARGINAL 234',
  estado: 'ACTIVO'
}
const real = { ...lugar, id: 'dm3', contribuyente: 'c1', codigo: '003', tipo_domicilio: 'REAL', via: 'LIMA', descripcion: 'JR. LIMA 123', estado: 'ACTIVO' }
// saved before the code existed
const antiguo = { ...lugar, id: 'dm9', contribuyente: 'c1', codigo: null, tipo_domicilio: 'REAL', via: 'PERU', descripcion: 'JR. PERU 9', estado: 'INACTIVO' }
const sustento = {
  id: 's2',
  contribuyente: 'c1',
  codigo: '002',
  documento: 'PODER ESPECIAL',
  numero_documento: 'PE-77',
  tipo_presentacion: 'ORIGINAL',
  folios: 2,
  estado: 'ACTIVO'
}
const medio = {
  id: 'm1',
  contribuyente: 'c1',
  codigo: '004',
  tipo: 'TELEFONO CELULAR',
  valor: '987654321',
  anexo: null,
  principal: true,
  observacion: null,
  estado: 'ACTIVO'
}
const nivel = {
  id: 'n1',
  declaracion: 'd1',
  tipo_nivel: 'PISO',
  numero_piso: 1,
  anio_construccion: 2024,
  mes_construccion: 3,
  material: 'LADRILLO',
  estado_conservacion: 'BUENO',
  area_construida: 200,
  area_comun: 0,
  muros_columnas: 'C',
  techos: 'C',
  puertas_ventanas: 'D',
  estado: 'ACTIVO'
}
const dj = {
  declaracion: { id: 'd1', contribuyente: 'c1', predio: 'p1', anio: year, numero_declaracion: 39147, condicion_propiedad: 'PROPIETARIO UNICO' },
  predio: { id: 'p1', codigo: '01-01-0001', tipo_predio: 'PREDIO URBANO', direccion: 'JR. LIMA 123', numero_registro: 5243 },
  contribuyente,
  actualizado: '2026-09-25T14:03:00Z'
}

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      domicilio: { tipo_domicilio: ['FISCAL', 'REAL'], tipo_predio: ['PREDIO URBANO'], estado: ['ACTIVO', 'INACTIVO'] },
      sustento: { documento: ['PODER ESPECIAL'], tipo_presentacion: ['ORIGINAL'], estado: ['ACTIVO', 'INACTIVO'] },
      medio_contacto: { tipo: ['TELEFONO CELULAR'], estado: ['ACTIVO', 'INACTIVO'] },
      nivel_construccion: { tipo_nivel: ['PISO'], material: ['LADRILLO'], estado_conservacion: ['BUENO'], estado: ['ACTIVO', 'INACTIVO'] }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  { path: '/srtm/vias', body: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } },
  { path: '/srtm/unidades-urbanas', body: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } },
  { path: '/srtm/categorias-valor', body: [] },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 0, totales: { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 } } },
  { path: '/srtm/contribuyentes/c1/domicilios', body: [fiscal, real, antiguo] },
  { path: '/srtm/contribuyentes/c1/sustentos', body: [sustento] },
  { path: '/srtm/contribuyentes/c1/medios-contacto', body: [medio] },
  { path: '/srtm/contribuyentes/c1/relacionados', body: [] },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: '/srtm/declaraciones/d1/transferentes', body: [] },
  { path: '/srtm/declaraciones/d1/niveles', body: [nivel] },
  { path: '/srtm/declaraciones/d1/obras', body: [] },
  { path: '/srtm/declaraciones/d1/frentes', body: [] }
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

const grid = (name: string) => screen.findByRole('grid', { name })
const fila = async (list: string, text: string) => within(await grid(list)).getByRole('row', { name: new RegExp(text) })
// a row's first column: its código / número
const codigo = (row: HTMLElement) => row.firstElementChild
const called = (method: string, path: string) =>
  waitFor(() => {
    const call = fetch!.calls.find((c) => c.method === method && c.path === path)
    expect(call).toBeDefined()
    return call!
  })

describe('listas del srtm', () => {
  it('offers +, edit and delete over the table, the last two waiting for a selected row', async () => {
    start('/contribuyentes/c1?tab=domicilios')
    await grid('Listado de domicilios')
    expect(screen.getByRole('button', { name: 'Agregar domicilio' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Editar domicilio' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar domicilio' })).toBeDisabled()
    // no buttons left in the rows
    expect(screen.queryByRole('button', { name: /(Editar|Eliminar) domicilio \d/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
  })

  it('edits the selected row from the toolbar', async () => {
    start('/contribuyentes/c1?tab=domicilios', [{ method: 'PUT', path: '/srtm/domicilios/dm3', body: real }])
    const row = await fila('Listado de domicilios', 'JR. LIMA 123')
    await userEvent.click(row)
    expect(row).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('row', { selected: true })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar domicilio' })
    expect(within(dialog).getByLabelText(/Tipo de domicilio/)).toHaveValue('REAL')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const put = await called('PUT', '/srtm/domicilios/dm3')
    expect(put.body).toMatchObject({ tipo_domicilio: 'REAL', via: 'LIMA' })
  })

  it('removes the selected row from the toolbar after confirming', async () => {
    start('/contribuyentes/c1?tab=sustento', [{ method: 'DELETE', path: '/srtm/sustentos/s2', status: 204 }])
    await userEvent.click(await fila('Listado de documentos sustento', 'PE-77'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar documento sustento' }))
    expect(fetch!.calls.some((c) => c.method === 'DELETE')).toBe(false)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await called('DELETE', '/srtm/sustentos/s2')
  })

  it('keeps the only fiscal domicilio from being removed, saying why', async () => {
    start('/contribuyentes/c1?tab=domicilios')
    await userEvent.click(await fila('Listado de domicilios', 'AV. MARGINAL 234'))
    const eliminar = screen.getByRole('button', { name: 'Eliminar domicilio' })
    expect(eliminar).toBeDisabled()
    expect(eliminar).toHaveAttribute('title', 'Es el único domicilio fiscal activo: no se puede eliminar')
    expect(screen.getByRole('button', { name: 'Editar domicilio' })).toBeEnabled()

    await userEvent.click(await fila('Listado de domicilios', 'JR. LIMA 123'))
    expect(screen.getByRole('button', { name: 'Eliminar domicilio' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Eliminar domicilio' })).not.toHaveAttribute('title')
  })

  it('moves the selection with the arrow keys and edits with Enter or a double click', async () => {
    start('/contribuyentes/c1?tab=domicilios')
    const first = await fila('Listado de domicilios', 'AV. MARGINAL 234')
    // the list is reached with Tab: its first row until one is selected
    expect(first).toHaveAttribute('tabindex', '0')
    act(() => first.focus())
    expect(first).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    const second = await fila('Listado de domicilios', 'JR. LIMA 123')
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
    fireEvent.keyDown(second, { key: 'ArrowUp' })
    expect(first).toHaveFocus()

    fireEvent.keyDown(first, { key: 'Enter' })
    expect(await screen.findByRole('dialog', { name: 'Editar domicilio' })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    await userEvent.dblClick(await fila('Listado de domicilios', 'JR. LIMA 123'))
    const dialog = await screen.findByRole('dialog', { name: 'Editar domicilio' })
    expect(within(dialog).getByLabelText(/Tipo de domicilio/)).toHaveValue('REAL')
  })

  it("acts the same on the declaración's lists", async () => {
    start('/declaraciones/d1?tab=caracteristicas', [{ method: 'PUT', path: '/srtm/niveles/n1', body: nivel }])
    const niveles = 'Listado de niveles de construcción'
    expect(screen.queryByRole('button', { name: 'Editar nivel de construcción' })).not.toBeInTheDocument()
    await grid(niveles)
    expect(screen.getByRole('button', { name: 'Editar nivel de construcción' })).toBeDisabled()
    await userEvent.click(await fila(niveles, 'LADRILLO'))
    await userEvent.click(screen.getByRole('button', { name: 'Editar nivel de construcción' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Editar nivel de construcción' })).getByRole('button', { name: 'Grabar' }))
    await called('PUT', '/srtm/niveles/n1')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // obras has no rows: its pencil and bin stay grey
    expect(screen.getByRole('button', { name: 'Editar obra complementaria' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar obra complementaria' })).toBeDisabled()
  })

  it('shows the code the backend stored, not the row position, and a dash for a row without one', async () => {
    start('/contribuyentes/c1?tab=domicilios')
    const rows = within(await grid('Listado de domicilios'))
      .getAllByRole('row')
      .slice(1)
    expect(codigo(rows[0])).toHaveTextContent('002')
    expect(codigo(rows[1])).toHaveTextContent('003')
    expect(codigo(rows[2])).toHaveTextContent('—')
  })

  it('numbers the documentos sustento and the medios de contacto by their stored code', async () => {
    start('/contribuyentes/c1?tab=sustento')
    const sustentos = await grid('Listado de documentos sustento')
    expect(within(sustentos).getByRole('columnheader', { name: 'Número' })).toBeInTheDocument()
    expect(codigo(within(sustentos).getAllByRole('row')[1])).toHaveTextContent('002')

    await userEvent.click(screen.getByRole('tab', { name: 'Medios de contacto' }))
    const medios = await grid('Listado de medios de contacto')
    expect(within(medios).getAllByRole('columnheader')[0]).toHaveTextContent('Código')
    expect(codigo(within(medios).getAllByRole('row')[1])).toHaveTextContent('004')
  })

  it('writes the footer, the estado and the empty list as the srtm does', async () => {
    start('/contribuyentes/c1?tab=sustento')
    expect(await screen.findByText('1 a 1 de 1 registros')).toBeInTheDocument()
    const activo = within(await grid('Listado de documentos sustento')).getByText('Activo')
    expect(activo).toHaveClass('bg-ink')

    await userEvent.click(screen.getByRole('tab', { name: 'Relacionados' }))
    expect(await screen.findByText('No se encontraron resultados!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar relacionado' })).toBeDisabled()
  })
})
