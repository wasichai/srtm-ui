import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute, type RecordedCall } from '@wasichai/testing'
import { siguientePendiente } from './pages/DeclaracionPage'
import { PortalApp } from './PortalApp'
import type { Declaracion } from './types'

// the DJ's derived values (srtm-backend#156/#159): área construida, área común construida and longitud de frente are
// the backend's sums, the autoavalúo is the catastro's (the user's only without one), and every write of the DJ or of
// its niveles, obras and otros frentes reads them again

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
  frontis_principal: 8,
  longitud_frente: 15,
  area_construida: 120,
  area_comun_construida: 10,
  valor_autoavaluo: 50000,
  valor_condominio: 50000,
  deduccion: null,
  valor_afecto: 50000,
  autoavaluo_por_revisar: false,
  autoavaluo_motivo: null,
  estado: 'VIGENTE'
}
const ficha = (d: object, autoavaluo_manual = false) => ({
  declaracion: d,
  predio,
  contribuyente: juan,
  actualizado: '2026-09-25T14:03:00Z',
  autoavaluo_manual
})
const nivel = {
  id: 'n1',
  fila: '6f1c2c1e-0000-4000-8000-000000000001',
  declaracion: 'd1',
  tipo_nivel: 'PISO',
  numero_piso: 1,
  anio_construccion: 2010,
  mes_construccion: 3,
  material: 'LADRILLO',
  estado_conservacion: 'BUENO',
  area_construida: 120,
  area_comun: 10,
  porcentaje_area_comun: null,
  muros_columnas: 'C',
  techos: 'C',
  pisos: 'D',
  puertas_ventanas: 'D',
  revestimientos: 'E',
  banos: 'D',
  instalaciones: 'D',
  estado: 'ACTIVO'
}
const frente = { id: 'f1', fila: '6f1c2c1e-0000-4000-8000-000000000002', declaracion: 'd1', tipo_via: 'AVENIDA', via: 'MARGINAL', frontis: 7, estado: 'ACTIVO' }

const grupo = (d: object) => [{ declaracion: d, predio: null, contribuyente: juan }]
const grupoRoute: MockRoute = { path: '/srtm/predios/p1/declaraciones', body: grupo(declaracion) }
const djRoute: MockRoute = { path: '/srtm/declaraciones/d1', body: ficha(declaracion) }
const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: { nivel_construccion: { tipo_nivel: ['PISO'], material: ['LADRILLO'], estado_conservacion: ['BUENO'], estado: ['ACTIVO'] } }
  },
  { path: '/srtm/categorias-valor', body: [] },
  djRoute,
  { path: '/srtm/declaraciones/d1/niveles', body: [nivel] },
  { path: '/srtm/declaraciones/d1/frentes', body: [frente] },
  { path: '/srtm/declaraciones/d1/valuacion-origen', status: 404, body: { title: 'Not Found' } },
  { path: /^\/srtm\/declaraciones\/d1\/(transferentes|obras)$/, body: [] },
  grupoRoute,
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales: { declaraciones: 1, autoavaluo: 50000, valor_afecto: 50000 } } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  djRoute.body = ficha(declaracion)
  grupoRoute.body = grupo(declaracion)
})
afterEach(() => fetch?.restore())

function start(extra: MockRoute[] = [], path = '/declaraciones/d1?tab=caracteristicas') {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const called = (match: (c: RecordedCall) => boolean) => waitFor(() => fetch!.calls.find(match)!)
const lecturas = (path: string) => fetch!.calls.filter((c) => c.method === 'GET' && c.path === path).length
const formulario = async () => {
  const panel = within(await screen.findByRole('tabpanel'))
  await panel.findByRole('group', { name: /^Valores/ })
  return panel
}
const filaBase = (servicio: string, base: string) => ({
  id: `p-${servicio}`,
  anio: year,
  tipo: 'BASE_ARBITRIO',
  servicio,
  texto: base,
  vigente_desde: `${year}-01-01`
})

describe('valores derivados de la DJ', () => {
  it('writes the frontis principal and shows the sums, the autoavalúo and its condominio and afecto read-only', async () => {
    start([{ method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion }])
    const panel = await formulario()
    expect(panel.getByLabelText('Frontis principal (m)')).toBeEnabled()
    expect(panel.getByLabelText('Frontis principal (m)')).toHaveValue('8')
    for (const [label, valor] of [
      ['Longitud de frente (m)', '15'],
      ['Área construida (m2)', '120'],
      ['Área común construida (m2)', '10'],
      ['Autoavalúo (S/)', '50000'],
      ['Valor de condominio (S/)', '50000'],
      ['Valor afecto (S/)', '50000']
    ]) {
      expect(panel.getByLabelText(label)).toBeDisabled()
      expect(panel.getByLabelText(label)).toHaveValue(valor)
    }
    expect(panel.getByLabelText('Longitud de frente (m)')).toHaveAccessibleDescription('frontis principal + otros frentes')
    expect(panel.getByLabelText('Área construida (m2)')).toHaveAccessibleDescription('suma de los niveles')
    expect(panel.getByLabelText('Área común construida (m2)')).toHaveAccessibleDescription('suma de los niveles')
    expect(panel.getByLabelText('Autoavalúo (S/)')).toHaveAccessibleDescription('calculado con el catastro')
    expect(panel.queryByLabelText('Frontis (m)')).not.toBeInTheDocument()

    await userEvent.clear(panel.getByLabelText('Frontis principal (m)'))
    await userEvent.type(panel.getByLabelText('Frontis principal (m)'), '9.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const put = await called((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')
    expect(put.body).toMatchObject({ frontis_principal: 9.5, numero_declaracion: 39147 })
  })

  it('lets the user write the autoavalúo where the municipalidad has no catastro', async () => {
    djRoute.body = ficha(declaracion, true)
    start([{ method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion }])
    const panel = await formulario()
    const autoavaluo = panel.getByLabelText('Autoavalúo (S/)')
    expect(autoavaluo).toBeEnabled()
    expect(panel.getByLabelText('Valor afecto (S/)')).toBeDisabled()
    await userEvent.clear(autoavaluo)
    await userEvent.type(autoavaluo, '61000')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const put = await called((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')
    expect(put.body).toMatchObject({ valor_autoavaluo: 61000 })
  })

  it('asks for the frontis principal, not the longitud de frente, when the year charges by FRONTIS_ML', async () => {
    djRoute.body = ficha({ ...declaracion, frontis_principal: null })
    start([
      { method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion },
      {
        path: '/srtm/arbitrios/parametros',
        body: {
          anio: year,
          ordenanza: null,
          servicios: [],
          parametros: [filaBase('LIMPIEZA', 'FRONTIS_ML'), filaBase('PARQUES', 'AREA_CONSTRUIDA_M2')],
          faltan: []
        }
      }
    ])
    const panel = await formulario()
    await waitFor(() => expect(panel.getByText(/^Frontis principal \(m\)/).textContent).toContain('*'))
    expect(panel.getByText(/^Longitud de frente/, { selector: 'label' }).textContent).not.toContain('*')
    expect(panel.getByText(/^Área construida/, { selector: 'label' }).textContent).not.toContain('*')
    await userEvent.type(panel.getByLabelText('Cant. de habitantes / Aforo'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await panel.findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('sends a new DJ to características while the year charges by FRONTIS_ML and it has no frontis principal', () => {
    const presentada = { ...declaracion, tipo_adquisicion: 'OTROS', frontis_principal: null, longitud_frente: 8 } as unknown as Declaracion
    expect(siguientePendiente(presentada, 0, new Set(['FRONTIS_ML']))).toBe('caracteristicas')
    expect(siguientePendiente({ ...presentada, frontis_principal: 8 }, 0, new Set(['FRONTIS_ML']))).toBe('transferentes')
    // the área construida is the niveles' sum: nothing the wizard can ask for in características' fields
    expect(siguientePendiente({ ...presentada, frontis_principal: 8, area_construida: null }, 0, new Set(['AREA_CONSTRUIDA_M2']))).toBe('transferentes')
  })
})

describe('autoavalúo por revisar', () => {
  it("says why, as a person reads the catastro's llave, and recalculates on demand", async () => {
    djRoute.body = ficha({ ...declaracion, autoavaluo_por_revisar: true, autoavaluo_motivo: `PARAMETRO_FALTANTE:PORCENTAJE_ACTUALIZACION:${year + 1}` })
    start([{ method: 'POST', path: '/srtm/declaraciones/d1/recalcular', body: { ...declaracion, valor_autoavaluo: 61000 } }])
    const aviso = await screen.findByRole('status', { name: 'Autoavalúo por revisar' })
    expect(aviso).toHaveTextContent(`Autoavalúo por revisar: No hay tablas de ${year + 1} en catastro`)
    const antes = lecturas('/srtm/declaraciones/d1')
    djRoute.body = ficha({ ...declaracion, valor_autoavaluo: 61000 })
    await userEvent.click(within(aviso).getByRole('button', { name: 'Recalcular' }))
    await called((c) => c.method === 'POST' && c.path === '/srtm/declaraciones/d1/recalcular')
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Autoavalúo por revisar' })).not.toBeInTheDocument())
    expect(lecturas('/srtm/declaraciones/d1')).toBeGreaterThan(antes)
    expect(screen.getByLabelText('Autoavalúo (S/)')).toHaveValue('61000')
  })

  it("shows the catastro's own words as they come, and the backend's refusal of a recálculo", async () => {
    djRoute.body = ficha({ ...declaracion, autoavaluo_por_revisar: true, autoavaluo_motivo: 'El catastro no respondió: 500' })
    start([{ method: 'POST', path: '/srtm/declaraciones/d1/recalcular', status: 502, body: { title: 'Bad Gateway', detail: 'catastro-backend no responde' } }])
    const aviso = await screen.findByRole('status', { name: 'Autoavalúo por revisar' })
    expect(aviso).toHaveTextContent('Autoavalúo por revisar: El catastro no respondió: 500')
    await userEvent.click(within(aviso).getByRole('button', { name: 'Recalcular' }))
    expect(await within(aviso).findByText(/catastro-backend no responde/)).toBeInTheDocument()
  })

  it('is told, without Recalcular, on a declaración that is only read', async () => {
    djRoute.body = ficha({ ...declaracion, estado: 'SUSTITUIDA', autoavaluo_por_revisar: true, autoavaluo_motivo: 'AREA_TERRENO_FALTANTE' })
    start()
    const aviso = await screen.findByRole('status', { name: 'Autoavalúo por revisar' })
    expect(aviso).toHaveTextContent('Autoavalúo por revisar: Falta el área del terreno')
    expect(within(aviso).queryByRole('button', { name: 'Recalcular' })).not.toBeInTheDocument()
  })

  it('is not there while the autoavalúo is the catastro’s', async () => {
    start()
    await formulario()
    expect(screen.queryByRole('status', { name: 'Autoavalúo por revisar' })).not.toBeInTheDocument()
  })
})

describe('after a write of the lists', () => {
  it('reads the DJ, its group and its origen again after a nivel is saved, and shows the new sums', async () => {
    start([{ method: 'PUT', path: '/srtm/niveles/n1', body: { ...nivel, area_construida: 150 } }], '/declaraciones/d1?tab=condominos')
    const condominos = await screen.findByRole('tabpanel')
    expect((await within(condominos).findAllByText('S/ 50,000.00')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: 'Características' }))
    const panel = await formulario()
    expect(panel.getByLabelText('Área construida (m2)')).toHaveValue('120')
    const antes = { dj: lecturas('/srtm/declaraciones/d1'), origen: lecturas('/srtm/declaraciones/d1/valuacion-origen') }
    const cambiada = { ...declaracion, area_construida: 150, valor_autoavaluo: 58000, valor_condominio: 58000, valor_afecto: 58000 }
    djRoute.body = ficha(cambiada)
    grupoRoute.body = grupo(cambiada)

    await userEvent.click(await screen.findByRole('cell', { name: 'LADRILLO' }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar nivel de construcción' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar nivel de construcción' })
    await userEvent.clear(within(dialog).getByLabelText(/Área construida/))
    await userEvent.type(within(dialog).getByLabelText(/Área construida/), '150')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))

    const put = await called((c) => c.method === 'PUT' && c.path === '/srtm/niveles/n1')
    // the fila is the backend's: never sent
    expect(put.body).not.toHaveProperty('fila')
    await waitFor(() => expect(panel.getByLabelText('Área construida (m2)')).toHaveValue('150'))
    expect(panel.getByLabelText('Autoavalúo (S/)')).toHaveValue('58000')
    expect(lecturas('/srtm/declaraciones/d1')).toBeGreaterThan(antes.dj)
    expect(lecturas('/srtm/declaraciones/d1/valuacion-origen')).toBeGreaterThan(antes.origen)
    // the group of condóminos, read again: its autoavalúo is the new one
    await userEvent.click(screen.getByRole('tab', { name: 'Datos de los condóminos' }))
    expect((await within(await screen.findByRole('tabpanel')).findAllByText('S/ 58,000.00')).length).toBeGreaterThan(0)
  })

  it('shows the new sums even while the características have changes of their own, which it keeps', async () => {
    start([{ method: 'DELETE', path: '/srtm/frentes/f1', status: 204 }], '/declaraciones/d1?tab=caracteristicas')
    const panel = await formulario()
    await userEvent.type(panel.getByLabelText('Cant. de habitantes / Aforo'), '4')
    djRoute.body = ficha({ ...declaracion, longitud_frente: 8 })

    await userEvent.click(screen.getByRole('tab', { name: 'Otros frentes' }))
    await userEvent.click(await screen.findByRole('cell', { name: 'MARGINAL' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar frente' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await called((c) => c.method === 'DELETE' && c.path === '/srtm/frentes/f1')

    await userEvent.click(screen.getByRole('tab', { name: 'Características' }))
    const otra = await formulario()
    await waitFor(() => expect(otra.getByLabelText('Longitud de frente (m)')).toHaveValue('8'))
    expect(otra.getByLabelText('Cant. de habitantes / Aforo')).toHaveValue('4')
  })
})

describe('ver cálculo del autoavalúo', () => {
  const VALUADA = {
    anio: year,
    version: 'valuacion-v2',
    region: 'SELVA',
    arancel_m2: 45.5,
    origen_arancel: 'CUERPO',
    terreno: 9100,
    construccion: 40000,
    obras: 900,
    autoavaluo: 50000,
    motivo: null,
    llave: null,
    detalle: { pisos: [], obras: [] }
  }
  const sugerido: MockRoute = { path: '/srtm/declaraciones/d1/autoavaluo-sugerido', body: VALUADA }

  it('shows how the catastro reached the autoavalúo, with nothing to take into the form', async () => {
    start([sugerido])
    await userEvent.click(await screen.findByRole('button', { name: 'Ver cálculo del autoavalúo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cálculo del autoavalúo' })
    expect(dialog).toHaveTextContent('S/ 50,000.00')
    expect(within(dialog).queryByRole('button', { name: 'Usar este valor' })).not.toBeInTheDocument()
  })

  it('offers its figure where the autoavalúo is the user’s', async () => {
    djRoute.body = ficha(declaracion, true)
    start([sugerido])
    await userEvent.click(await screen.findByRole('button', { name: 'Ver cálculo del autoavalúo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cálculo del autoavalúo' })
    expect(within(dialog).getByRole('button', { name: 'Usar este valor' })).toBeInTheDocument()
  })
})
