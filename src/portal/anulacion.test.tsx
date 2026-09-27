import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// anulación y baja (srtm-backend#7): a declaración jurada is annulled with a motivo (a descargo) and then only read;
// the fichas list it marked as annulled; a contribuyente or predio is deleted from its ficha unless the backend refuses

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', codigo: '000123', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const rosa = { id: 'c2', codigo: '000124', tipo_documento: 'DNI', numero_documento: '43434352', nombre_completo: 'NEIRA CAMPOS ROSA' }
const predio = { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', condicion: 'URBANO' }
const libre = { id: 'p2', codigo: '01-01-0002', direccion: 'JR. LIMA 125', condicion: 'URBANO' }

const declaracion = (valores: Record<string, unknown>) => ({
  predio: 'p1',
  anio: year,
  secuencia_uso: '1',
  uso: 'RESIDENCIAL - CASA HABITACION',
  valor_autoavaluo: 10000.5,
  deduccion: null,
  ...valores
})
// juan holds p1 alone since rosa's declaration was annulled
const vigente = declaracion({
  id: 'd1',
  contribuyente: 'c1',
  numero_declaracion: 39147,
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  valor_condominio: 10000.5,
  valor_afecto: 10000.5,
  motivo: 'INSCRIPCION',
  estado: 'VIGENTE'
})
const anulada = declaracion({
  id: 'd2',
  contribuyente: 'c2',
  numero_declaracion: 39148,
  condicion_propiedad: 'CONDOMINO',
  porcentaje_condominio: 40,
  valor_condominio: 4000.2,
  valor_afecto: 4000.2,
  motivo: 'DESCARGO',
  estado: 'ANULADA',
  motivo_anulacion: 'Declarada dos veces',
  fecha_anulacion: `${year}-09-20`
})
const ficha = (d: object, contribuyente: object) => ({ declaracion: d, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' })
const ceros = { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 2, predios: 2, declaraciones: 2 } },
  { path: '/srtm/declaraciones/d1', body: ficha(vigente, juan) },
  { path: '/srtm/declaraciones/d2', body: ficha(anulada, rosa) },
  { path: '/srtm/declaraciones/d2/frentes', body: [{ id: 'f1', declaracion: 'd2', tipo_via: 'AVENIDA', via: 'MARGINAL', frontis: 7, estado: 'ACTIVO' }] },
  { path: /^\/srtm\/declaraciones\/d\d\/(transferentes|niveles|obras|frentes)$/, body: [] },
  {
    path: '/srtm/predios/p1/declaraciones',
    body: [
      { declaracion: vigente, predio: null, contribuyente: juan },
      { declaracion: anulada, predio: null, contribuyente: rosa }
    ]
  },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales: { declaraciones: 1, autoavaluo: 10000.5, valor_afecto: 10000.5 } } },
  { path: '/srtm/predios/p2/declaraciones', body: [] },
  { path: '/srtm/predios/p2', body: { predio: libre, anio: year, titulares: 0, totales: ceros } },
  { path: '/srtm/contribuyentes/c2/declaraciones', body: [{ declaracion: anulada, predio, contribuyente: null }] },
  { path: '/srtm/contribuyentes/c2', body: { contribuyente: rosa, anio: year, predios: 0, totales: ceros } }
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

const called = (method: string, path: string) => fetch!.calls.find((c) => c.method === method && c.path === path)

describe('anular una declaración jurada', () => {
  it('annuls a vigente declaration from its header, once its motivo is given', async () => {
    start('/declaraciones/d1', [
      {
        method: 'POST',
        path: '/srtm/declaraciones/d1/anular',
        body: { ...vigente, estado: 'ANULADA', motivo: 'DESCARGO', motivo_anulacion: 'Declarada dos veces', fecha_anulacion: `${year}-09-27` }
      }
    ])
    await screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })
    expect(screen.getByText('Vigente')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Anular declaración' }))
    const dialog = await screen.findByRole('dialog', { name: 'Anular la declaración jurada 39147' })
    expect(dialog).toHaveTextContent(/deja de contar en los totales y en el condominio/)
    // why, first
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }))
    expect(await within(dialog).findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(called('POST', '/srtm/declaraciones/d1/anular')).toBeUndefined()

    await userEvent.type(within(dialog).getByLabelText(/Motivo de la anulación/), 'Declarada dos veces')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular' }))
    const post = await waitFor(() => called('POST', '/srtm/declaraciones/d1/anular')!)
    expect(post.body).toEqual({ motivo_anulacion: 'Declarada dos veces' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows when and why an annulled declaration was annulled, and only reads it', async () => {
    start('/declaraciones/d2')
    expect(await screen.findByText(`Declaración anulada el 20/09/${year}`)).toBeInTheDocument()
    expect(screen.getByText('Declarada dos veces')).toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular declaración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Otros frentes' }))
    expect(await screen.findByText('MARGINAL')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar frente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar frente 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar frente 1' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Características' }))
    expect(await screen.findByText(/Listado de niveles de construcción/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar nivel de construcción' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Datos de los condóminos' }))
    expect(await screen.findByText(/Listado de condóminos/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar condómino' })).not.toBeInTheDocument()
  })

  it("leaves an annulled declaration out of the predio's condóminos", async () => {
    start('/declaraciones/d1?tab=condominos')
    expect(await screen.findByRole('link', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    expect(screen.getByText(/suman 100 % de propiedad/)).toBeInTheDocument()
    expect(screen.queryByText('NEIRA CAMPOS ROSA')).not.toBeInTheDocument()
  })
})

describe('declaraciones anuladas en las fichas', () => {
  it("marks the annulled ones among a contribuyente's declarations", async () => {
    start('/contribuyentes/c2?tab=declaraciones')
    const row = (await screen.findByRole('link', { name: '39148' })).closest('tr')!
    expect(row).toHaveTextContent('Anulada')
  })

  it("marks the annulled ones among a predio's titulares of the year", async () => {
    start('/predios/p1?tab=titulares')
    const rosaRow = (await screen.findByRole('link', { name: 'NEIRA CAMPOS ROSA' })).closest('tr')!
    expect(rosaRow).toHaveTextContent('Anulada')
    const juanRow = screen.getByRole('link', { name: 'QUISPE MAMANI JUAN' }).closest('tr')!
    expect(juanRow).not.toHaveTextContent('Anulada')
  })
})

describe('eliminar una ficha', () => {
  it('says why the backend refuses to delete a contribuyente with declarations', async () => {
    const detail = 'El contribuyente tiene 1 declaración jurada: no se puede eliminar'
    start('/contribuyentes/c2', [{ method: 'DELETE', path: '/srtm/contribuyentes/c2', status: 409, body: { title: 'Conflict', detail } }])
    await screen.findByRole('heading', { name: 'NEIRA CAMPOS ROSA' })
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este contribuyente?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(await within(dialog).findByText(detail)).toBeInTheDocument()
    expect(called('DELETE', '/srtm/contribuyentes/c2')).toBeDefined()
    expect(window.location.pathname).toBe('/contribuyentes/c2')
  })

  it('deletes a predio without declarations once confirmed, and closes its tab', async () => {
    start('/predios/p2', [{ method: 'DELETE', path: '/srtm/predios/p2', status: 204 }])
    const tabs = await screen.findByRole('navigation', { name: 'Fichas abiertas' })
    expect(await within(tabs).findByRole('button', { name: 'Cerrar 01-01-0002' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este predio?' })
    // cancelling keeps it
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(called('DELETE', '/srtm/predios/p2')).toBeUndefined()

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(called('DELETE', '/srtm/predios/p2')).toBeDefined()
    expect(within(tabs).queryByRole('button', { name: 'Cerrar 01-01-0002' })).not.toBeInTheDocument()
  })
})
