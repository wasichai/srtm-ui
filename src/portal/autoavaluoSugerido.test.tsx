import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { motivoLegible } from './pages/AutoavaluoSugerido'
import { PortalApp } from './PortalApp'

// the autoavalúo sugerido (srtm-backend#152): the organization's catastro-backend values the declaración, its predio,
// niveles and obras; the portal shows how, and the user may take the figure into the form, still to be saved. nothing
// is stored by asking

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const predio = { id: 'p1', codigo: '01-01-0006', direccion: 'JR. LIMA 123', tipo_predio: 'PREDIO URBANO' }
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  secuencia_uso: '001',
  numero_declaracion: 39147,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACIÓN',
  area_terreno: 200,
  valor_autoavaluo: 50000,
  estado: 'VIGENTE'
}
const ficha = (d: object) => ({ declaracion: d, predio, contribuyente: juan, actualizado: '2026-09-25T14:03:00Z' })

// srtm-backend#152's example
const VALUADA = {
  anio: year,
  version: 'valuacion-v2',
  region: 'SELVA',
  codigo_municipal: '01-01-0006',
  arancel_m2: 45.5,
  origen_arancel: 'CUERPO',
  terreno: 9100,
  construccion: 78781.6,
  obras: 8870.61,
  autoavaluo: 96752.21,
  motivo: null,
  llave: null,
  detalle: {
    pisos: [
      {
        piso: '1',
        seccion: null,
        area_construida: 100,
        valor_unitario: 829.28,
        incremento: 0,
        tabla_depreciacion: '01',
        antiguedad: 10,
        porcentaje_depreciacion: 5,
        valor_unitario_depreciado: 787.816,
        valor: 78781.6
      }
    ],
    obras: [
      {
        codigo_vu: 'MUROS PERIMETRICOS O CERCOS|1',
        cantidad: 30,
        valor_unitario: 457.72,
        factor_oficializacion: 0.68,
        tabla_depreciacion: '01',
        antiguedad: 10,
        porcentaje_depreciacion: 5,
        valor: 8870.61
      }
    ]
  }
}
const SIN_VALOR = {
  ...VALUADA,
  terreno: null,
  construccion: null,
  obras: null,
  autoavaluo: null,
  detalle: null,
  motivo: `Las tablas no traen el parámetro PORCENTAJE_ACTUALIZACION para ${year + 1}`,
  llave: `PARAMETRO_FALTANTE:PORCENTAJE_ACTUALIZACION:${year + 1}`
}

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/declaraciones/d1', body: ficha(declaracion) },
  { path: /^\/srtm\/declaraciones\/d1\/(transferentes|niveles|obras|frentes)$/, body: [] },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente: juan }] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

function start(extra: MockRoute[] = [], path = '/declaraciones/d1?tab=caracteristicas') {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const sugerido = (status: number, body: unknown): MockRoute => ({ path: '/srtm/declaraciones/d1/autoavaluo-sugerido', status, body })
const calcular = async () => userEvent.click(await screen.findByRole('button', { name: 'Calcular autoavalúo sugerido' }))

describe('autoavalúo sugerido', () => {
  it('shows how the catastro values the declaración, and puts its figure in the form, still to be saved', async () => {
    start([sugerido(200, VALUADA), { method: 'PUT', path: '/srtm/declaraciones/d1', body: { ...declaracion, valor_autoavaluo: 96752.21 } }])
    expect(fetch!.calls.some((c) => c.path.endsWith('/autoavaluo-sugerido'))).toBe(false)
    await calcular()
    const dialog = await screen.findByRole('dialog', { name: 'Autoavalúo sugerido' })
    expect(dialog).toHaveTextContent('S/ 96,752.21')
    expect(dialog).toHaveTextContent('S/ 9,100.00')
    expect(dialog).toHaveTextContent('S/ 78,781.60')
    expect(dialog).toHaveTextContent('S/ 8,870.61')
    expect(dialog).toHaveTextContent('SELVA')
    expect(dialog).toHaveTextContent('valuacion-v2')
    expect(dialog).toHaveTextContent('Arancel de la declaración (padrón de origen)')
    const pisos = within(dialog).getByRole('table', { name: 'Construcción por piso' })
    const [, piso] = within(pisos).getAllByRole('row')
    expect(
      within(piso)
        .getAllByRole('cell')
        .map((c) => c.textContent?.replace(/\s/g, ' '))
    ).toEqual(['1', '100', 'S/ 829.28', 'S/ 0.00', '5', 'S/ 787.82', 'S/ 78,781.60'])
    const obras = within(dialog).getByRole('table', { name: 'Obras complementarias' })
    expect(obras).toHaveTextContent('MUROS PERIMETRICOS O CERCOS|1')
    expect(obras).toHaveTextContent('S/ 8,870.61')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar este valor' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText(/Autoavalúo \(S\/\)/)).toHaveValue('96752.21')
    // nothing saved yet: the user saves it
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const put = await waitFor(() => fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')!)
    expect(put.body).toMatchObject({ valor_autoavaluo: 96752.21 })
  })

  it('says why the catastro did not value it, and offers no figure', async () => {
    start([sugerido(200, SIN_VALOR)])
    await calcular()
    const dialog = await screen.findByRole('dialog', { name: 'Autoavalúo sugerido' })
    expect(dialog).toHaveTextContent(`No hay tablas de ${year + 1} en catastro`)
    expect(dialog).toHaveTextContent(SIN_VALOR.motivo)
    expect(within(dialog).queryByRole('button', { name: 'Usar este valor' })).not.toBeInTheDocument()
  })

  it('is disabled, and says so, when the municipalidad has no catastro (409)', async () => {
    start([sugerido(409, { title: 'Conflict', detail: 'Catastro no configurado para esta organización' })])
    await calcular()
    expect(await screen.findByText('La municipalidad no tiene catastro configurado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calcular autoavalúo sugerido' })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("says the catastro failed (502), with the backend's reason", async () => {
    start([sugerido(502, { title: 'Bad Gateway', detail: 'catastro-backend respondió 500 a la valuación de los insumos' })])
    await calcular()
    expect(await screen.findByText(/catastro-backend respondió 500/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calcular autoavalúo sugerido' })).toBeEnabled()
  })

  it('is not offered on a declaración that is only read', async () => {
    start([{ path: '/srtm/declaraciones/d1', body: ficha({ ...declaracion, estado: 'SUSTITUIDA' }) }])
    expect(await screen.findByText(/Listado de niveles de construcción/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Calcular autoavalúo sugerido' })).not.toBeInTheDocument()
  })
})

describe('motivoLegible', () => {
  it('reads the catastro llaves it knows, and leaves any other as it comes', () => {
    expect(motivoLegible('ARANCEL_FALTANTE')).toBe('La vía del predio no tiene arancel en catastro')
    expect(motivoLegible('PARAMETRO_FALTANTE:PORCENTAJE_ACTUALIZACION:2027')).toBe('No hay tablas de 2027 en catastro')
    expect(motivoLegible('OBRA_DESCONOCIDA:PISCINA|9')).toBe('Catastro no conoce la obra PISCINA|9')
    expect(motivoLegible('AREA_TERRENO_FALTANTE')).toBe('Falta el área del terreno')
    expect(motivoLegible('ALGO_NUEVO:X')).toBe('ALGO_NUEVO:X')
    expect(motivoLegible(null)).toBeNull()
  })
})
