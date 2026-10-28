import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { VisorMapaProps } from './pages/visor/VisorMapa'
import { PortalApp } from './PortalApp'

// el visor de brechas (wasichai/srtm-ui#154): el panel de Brechas de catastro-ui sobre la corrida de srtm, solo de
// lectura, contra el contrato de srtm-backend /api/srtm/visor. todas las cifras y las decisiones son del backend

// jsdom has no webgl: the map tells what it was handed
vi.mock('./pages/visor/VisorMapa', () => ({
  default: ({ lotes, colorear, wms, mostrarVias, vias, clave }: VisorMapaProps) => (
    <div
      data-testid="visor-mapa"
      data-lotes={lotes?.features.length ?? 0}
      data-colorear={colorear}
      data-wms={JSON.stringify(wms)}
      data-vias={mostrarVias ? (vias?.features.length ?? 0) : 'no'}
      data-clave={clave}
    />
  )
}))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const corrida = (id: string, terminado: string) => ({
  id,
  anio: year,
  estado: 'TERMINADA',
  versionCatastro: 'valuacion-v2',
  iniciado: terminado,
  terminado,
  totalPredios: 4,
  procesados: 4,
  mensaje: null,
  declarado: null,
  catastro: null,
  deltaImpuesto: null,
  deltaArbitrios: null
})
const corridas = [corrida('c2', `${year}-10-20T15:00:00Z`), corrida('c1', `${year}-10-10T15:00:00Z`)]

const panel = {
  corrida: { id: 'c2', anio: year, terminado: `${year}-10-20T15:00:00Z`, version_catastro: 'valuacion-v2' },
  kpis: {
    fichas: 30706,
    delta_impuesto: 123456.78,
    delta_impuesto_confiable: 98765.4,
    omisos_estimado: 4321,
    supera_5_uit: 12,
    pendientes: 30000,
    con_geometria: 29000
  },
  por_categoria: [
    { clave: 'OMISO', fichas: 80, delta_impuesto: 3000 },
    { clave: 'SUBVALUADO', fichas: 300, delta_impuesto: 9800 },
    { clave: 'SOBREVALUADO', fichas: 40, delta_impuesto: -454.33 }
  ],
  por_confianza: [
    { clave: 'CONFIABLE', fichas: 700, delta_impuesto: 9000 },
    { clave: null, fichas: 3, delta_impuesto: 0 }
  ],
  por_estado: [
    { clave: 'PENDIENTE', fichas: 30000 },
    { clave: 'A_FISCALIZAR', fichas: 6 }
  ],
  top_sectores: [
    { sector: '01', fichas: 600, delta_impuesto: 10000 },
    { sector: '02', fichas: 400, delta_impuesto: -300 }
  ]
}

const fila = (valores: Record<string, unknown>) => ({
  id: 'b1',
  predio: 'p1',
  declaracion: 'd1',
  codigo_predio: '01-01-0001',
  codigo_catastro: 'PM-1',
  sector: '01',
  manzana: 'A',
  lote: '1',
  uso: '010101',
  categoria: 'SUBVALUADO',
  confianza: 'CONFIABLE',
  impuesto_declarado: 330,
  impuesto_catastro: 630,
  delta_impuesto: 300,
  delta_arbitrios: 42,
  estimado: false,
  supera_5_uit: true,
  estado: 'A_FISCALIZAR',
  con_geometria: true,
  ...valores
})

const predios = {
  content: [
    fila({}),
    fila({
      id: 'b2',
      predio: null,
      declaracion: null,
      codigo_predio: null,
      codigo_catastro: 'PM-2',
      categoria: 'OMISO',
      confianza: 'DUDOSO',
      impuesto_declarado: null,
      delta_impuesto: 240,
      delta_arbitrios: null,
      estimado: true,
      supera_5_uit: null,
      estado: null,
      con_geometria: false
    })
  ],
  page: 0,
  size: 50,
  totalElements: 2,
  totalPages: 1
}

const lotes = {
  type: 'FeatureCollection',
  features: ['b1', 'b2'].map((id) => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-75.73, -14.07] },
    properties: { codigo: id, categoria: 'SUBVALUADO', confianza: 'CONFIABLE', delta_impuesto: 1, estado: 'PENDIENTE', supera_5_uit: false }
  }))
}

const niveles = [
  { piso: 1, area_rentas: 100, area_catastro: 120.5, estado: 'PAR', delta: 20.5 },
  { piso: 2, area_rentas: null, area_catastro: 80, estado: 'SOLO_CATASTRO', delta: null }
]

const vias = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [] },
      properties: { tip_via: 'AV', nom_via: 'Grau', lado: 'AMBOS', asignacion: 'NOMBRE_UNICO', anio: year, valor_m2: 120 }
    }
  ]
}

const capas = [
  { layerName: 'predio_catastral__0a1b2c3d__geom', label: 'Predios' },
  { layerName: 'tramo_via__0a1b2c3d__geom', label: 'Tramos de vía' }
]

const base = (permisos: unknown): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } },
  { path: '/srtm/brecha/corridas', body: corridas },
  { path: '/srtm/visor/panel', body: panel },
  { path: '/srtm/visor/predios', body: predios },
  { path: '/srtm/visor/predios.csv', body: 'codigo\n' },
  { path: '/srtm/visor/predios/b1/niveles', body: niveles },
  { path: '/srtm/visor/lotes', body: lotes },
  { path: '/srtm/visor/vias', body: vias },
  { path: '/srtm/visor/capas', body: capas }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function start(path: string, extra: MockRoute[] = [], permisos: unknown = { admin: true, objects: {} }) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...base(permisos)])
  render(<PortalApp />)
}

const llamadas = (path: string) => fetch!.calls.filter((c) => c.method === 'GET' && c.path.split('?')[0] === path).map((c) => c.path)
const barras = (nombre: string) =>
  within(screen.getByRole('list', { name: nombre }))
    .getAllByRole('listitem')
    .map((li) => li.textContent?.replace(/ /g, ' '))
const filas = (): HTMLTableRowElement[] =>
  within(screen.getByRole('table', { name: 'Predios de la brecha' }))
    .getAllByRole<HTMLTableRowElement>('row')
    .slice(1)
const kpi = (nombre: string) => screen.getByRole('group', { name: nombre }).textContent?.replace(/ /g, ' ')
const mapa = () => screen.getByTestId('visor-mapa')

// a screen of `ancho` px for the css media queries (jsdom has no matchMedia)
function pantalla(ancho: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = /min-width:\s*([\d.]+)(px|rem)/.exec(query)
    const max = /max-width:\s*(\d+)px/.exec(query)
    const px = min ? Number(min[1]) * (min[2] === 'rem' ? 16 : 1) : null
    return {
      matches: px !== null ? ancho >= px : max ? ancho <= Number(max[1]) : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }
  })
}

describe('visor de brechas', () => {
  it('is reached from the brecha de recaudación', async () => {
    start('/brecha')
    await userEvent.click(await screen.findByRole('link', { name: 'Visor de brechas' }))
    expect(await screen.findByRole('heading', { name: 'Visor de brechas' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/brecha/visor')
  })

  it('is not offered, nor asked for, without READ on brecha_corrida', async () => {
    start('/brecha', [], { admin: false, objects: {} })
    await screen.findByRole('heading', { name: 'Brecha de recaudación' })
    expect(await screen.findByRole('link', { name: 'Cambios en catastro' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Visor de brechas' })).not.toBeInTheDocument()

    window.history.pushState({}, '', '/brecha/visor')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(await screen.findByText(/Sin permiso para ver el visor/)).toBeInTheDocument()
    expect(llamadas('/srtm/visor/panel')).toHaveLength(0)
    expect(llamadas('/srtm/visor/predios')).toHaveLength(0)
  })

  it('shows the 6 KPIs and the 4 panels of bars of the latest TERMINADA corrida', async () => {
    start('/brecha/visor')
    await screen.findByRole('region', { name: 'Indicadores de la corrida' })
    expect(llamadas('/srtm/visor/panel')[0]).toBe(`/srtm/visor/panel?anio=${year}`)
    expect(screen.getByRole('region', { name: 'Corrida' })).toHaveTextContent('Catastro valuacion-v2')
    expect(kpi('Diferencia de impuesto')).toContain('+S/ 123,456.78')
    expect(kpi('Diferencia de impuesto')).toContain('en 30,706 predios')
    expect(kpi('Diferencia confiable')).toContain('+S/ 98,765.40')
    expect(kpi('Omisos estimados')).toContain('+S/ 4,321.00')
    expect(kpi('Superan 5 UIT')).toContain('12')
    expect(kpi('Pendientes de decidir')).toContain('30,000')
    expect(kpi('Con geometría')).toContain('29,000de 30,706')
    expect(barras('Por categoría')).toEqual(['Omiso80 · +S/ 3,000.00', 'Subvaluado300 · +S/ 9,800.00', 'Sobrevaluado40 · −S/ 454.33'])
    expect(barras('Por confianza')).toEqual(['Confiable700 · +S/ 9,000.00', 'Sin confianza3 · S/ 0.00'])
    expect(barras('Por estado')).toEqual(['Pendiente30,000', 'A fiscalizar6'])
    expect(barras('Sectores con más diferencia de impuesto')).toEqual(['Sector 01600 · +S/ 10,000.00', 'Sector 02400 · −S/ 300.00'])
    // catastro-ui's colours: OMISO red, a negative Δ blue
    expect(screen.getByTestId('barra-categoria-OMISO')).toHaveStyle({ background: '#e15759' })
    expect(screen.getByTestId('barra-sector-02-1')).toHaveStyle({ background: '#2166ac' })
  })

  it('says when the year has no brecha, asking for no rows nor lotes', async () => {
    start('/brecha/visor', [{ path: '/srtm/visor/panel', status: 404, body: { title: 'Not Found', status: 404 } }])
    expect(await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)).toBeInTheDocument()
    expect(llamadas('/srtm/visor/predios')).toHaveLength(0)
    expect(llamadas('/srtm/visor/lotes')).toHaveLength(0)
  })

  it('lists the rows with catastro’s decision, linking srtm’s predio and DJ', async () => {
    start('/brecha/visor')
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(llamadas('/srtm/visor/predios')[0]).toBe(`/srtm/visor/predios?anio=${year}&orden=delta_desc&page=0&size=50`)
    const [primera, segunda] = filas()
    const texto = (f: HTMLTableRowElement) => Array.from(f.cells).map((c) => c.textContent?.replace(/ /g, ' '))
    expect(texto(primera).slice(0, 13)).toEqual([
      '01-01-0001',
      'PM-1',
      '01-A-1',
      '010101',
      'Subvaluado',
      'Confiable',
      'S/ 330.00',
      'S/ 630.00',
      '+S/ 300.00',
      '+S/ 42.00',
      'Sí',
      'A fiscalizar',
      'Ver DJ'
    ])
    expect(within(primera).getByRole('link', { name: '01-01-0001' })).toHaveAttribute('href', '/predios/p1')
    expect(within(primera).getByRole('link', { name: 'Declaración de 01-01-0001' })).toHaveAttribute('href', '/declaraciones/d1')
    // an omiso has neither predio nor DJ in srtm; no decision read is said so, never a «Pendiente»
    expect(within(segunda).queryAllByRole('link')).toHaveLength(0)
    expect(texto(segunda)[8]).toBe('+S/ 240.00(estimado)')
    expect(texto(segunda)[11]).toBe('Sin dato')
    expect(within(segunda).getByRole('img', { name: 'Sin geometría: el lote no aparece en el mapa' })).toBeInTheDocument()
    // nothing that writes: no decision, no selection
    expect(screen.queryByRole('button', { name: /Decidir/ })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox', { name: /Elegir/ })).toHaveLength(0)
  })

  it('filters the rows and the lotes alike, and goes back to the first page', async () => {
    start('/brecha/visor')
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    const filtros = screen.getByRole('search', { name: 'Filtros de los predios' })
    await userEvent.click(within(within(filtros).getByRole('group', { name: 'Categoría' })).getByRole('button', { name: 'Omiso' }))
    await userEvent.click(within(within(filtros).getByRole('group', { name: 'Estado' })).getByRole('button', { name: 'A fiscalizar' }))
    await userEvent.click(within(within(filtros).getByRole('group', { name: 'Estado' })).getByRole('button', { name: 'Pendiente' }))
    await userEvent.selectOptions(within(filtros).getByRole('combobox', { name: 'Supera 5 UIT' }), 'true')
    await userEvent.type(within(filtros).getByRole('spinbutton', { name: /Diferencia mínima/ }), '50')
    await userEvent.type(within(filtros).getByRole('textbox', { name: 'Sector' }), '01')
    const esperado = `anio=${year}&categoria=OMISO&estado=A_FISCALIZAR%2CPENDIENTE&sector=01&supera_5_uit=true&min_delta=50`
    await waitFor(() => expect(llamadas('/srtm/visor/predios').at(-1)).toBe(`/srtm/visor/predios?${esperado}&orden=delta_desc&page=0&size=50`))
    expect(llamadas('/srtm/visor/lotes').at(-1)).toBe(`/srtm/visor/lotes?${esperado}`)

    await userEvent.selectOptions(within(filtros).getByRole('combobox', { name: 'Orden' }), 'codigo')
    await waitFor(() => expect(llamadas('/srtm/visor/predios').at(-1)).toBe(`/srtm/visor/predios?${esperado}&orden=codigo&page=0&size=50`))
    // the orden is not the lotes'
    expect(llamadas('/srtm/visor/lotes').at(-1)).toBe(`/srtm/visor/lotes?${esperado}`)
  })

  it('pages by 25, 50 or 100', async () => {
    start('/brecha/visor', [{ path: '/srtm/visor/predios', body: { ...predios, totalElements: 260, totalPages: 6 } }])
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    const tamanio = await screen.findByRole('combobox', { name: /por página|Filas/i })
    expect(
      within(tamanio)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['25', '50', '100'])
    await userEvent.selectOptions(tamanio, '100')
    await waitFor(() => expect(llamadas('/srtm/visor/predios').at(-1)).toContain('page=0&size=100'))
  })

  it('opens the niveles of a row in a table on a wide screen', async () => {
    start('/brecha/visor')
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ver los niveles de 01-01-0001' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('heading', { name: 'Predio 01-01-0001' })).toBeInTheDocument()
    const tabla = await within(dialogo).findByRole('table', { name: 'Niveles del predio' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    expect(dialogo.textContent?.replace(/ /g, ' ')).toContain('Más área en catastro en los pisos de ambos: +20.5 m²')
    expect(within(tabla).getByText('Solo en catastro')).toBeInTheDocument()
    expect(llamadas('/srtm/visor/predios/b1/niveles')).toHaveLength(1)
  })

  it('shows the niveles as one card per piso on a narrow screen', async () => {
    pantalla(390)
    start('/brecha/visor')
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ver los niveles de 01-01-0001' }))
    const dialogo = await screen.findByRole('dialog')
    const tarjetas = await within(dialogo).findByRole('list', { name: 'Niveles del predio' })
    expect(
      within(tarjetas)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label'))
    ).toEqual(['Piso 1', 'Piso 2'])
    expect(within(dialogo).queryByRole('table')).not.toBeInTheDocument()
  })

  it('hands the map the lotes and the colouring, and the legend follows it', async () => {
    start('/brecha/visor')
    await waitFor(() => expect(mapa()).toHaveAttribute('data-lotes', '2'))
    expect(llamadas('/srtm/visor/lotes')[0]).toBe(`/srtm/visor/lotes?anio=${year}`)
    expect(mapa()).toHaveAttribute('data-colorear', 'categoria')
    const leyenda = screen.getByRole('region', { name: 'Leyenda' })
    expect(leyenda).toHaveTextContent('Omiso')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Colorear lotes por' }), 'delta')
    expect(mapa()).toHaveAttribute('data-colorear', 'delta')
    const texto = leyenda.textContent?.replace(/ /g, ' ')
    expect(texto).toContain('+S/ 500 o más')
    expect(texto).toContain('Sin cambio (−S/ 1 a +S/ 1)')
    expect(texto).toContain('Menos de −S/ 500')
  })

  it('folds the legend behind a button on a narrow screen, closed at first', async () => {
    pantalla(390)
    start('/brecha/visor')
    const boton = await screen.findByRole('button', { name: 'Leyenda' })
    const leyenda = document.getElementById(boton.getAttribute('aria-controls')!)!
    expect(leyenda).toHaveAttribute('aria-label', 'Leyenda')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(leyenda).not.toBeVisible()
    expect(screen.queryByRole('region', { name: 'Leyenda' })).not.toBeInTheDocument()
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Leyenda' })).toHaveTextContent('Omiso')
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(leyenda).not.toBeVisible()
  })

  it('keeps the legend open, with no button, on a wide screen', async () => {
    pantalla(1280)
    start('/brecha/visor')
    expect(await screen.findByRole('region', { name: 'Leyenda' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Leyenda' })).not.toBeInTheDocument()
  })

  it('turns catastro’s WMS layers on with an opacity of 70 %, in steps of 5', async () => {
    start('/brecha/visor')
    const lista = await screen.findByRole('list', { name: 'Capas WMS' })
    expect(llamadas('/srtm/visor/capas')).toHaveLength(1)
    const opacidad = within(lista).getByRole('slider', { name: 'Opacidad de Predios' })
    expect(opacidad).toBeDisabled()
    expect(opacidad).toHaveAttribute('step', '5')
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Predios' }))
    expect(JSON.parse(mapa().dataset.wms!)).toEqual([{ layerName: 'predio_catastral__0a1b2c3d__geom', opacity: 0.7 }])
    expect(opacidad).toHaveValue('70')
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Predios' }))
    expect(JSON.parse(mapa().dataset.wms!)).toEqual([])
  })

  it('draws the vías of the year when asked, and only then asks for them', async () => {
    start('/brecha/visor')
    await waitFor(() => expect(mapa()).toHaveAttribute('data-lotes', '2'))
    expect(llamadas('/srtm/visor/vias')).toHaveLength(0)
    await userEvent.click(screen.getByRole('checkbox', { name: /Vías con arancel/ }))
    await waitFor(() => expect(mapa()).toHaveAttribute('data-vias', '1'))
    expect(llamadas('/srtm/visor/vias')[0]).toBe(`/srtm/visor/vias?anio=${year}`)
    expect(screen.getByRole('region', { name: 'Leyenda' })).toHaveTextContent(`Vías: valor por m² (${year})`)
  })

  it('goes on without catastro: no capas nor vías, and says why', async () => {
    const sinCatastro = { title: 'Conflict', status: 409, detail: 'SIN_CATASTRO_CONFIGURADO' }
    start('/brecha/visor', [
      { path: '/srtm/visor/capas', status: 409, body: sinCatastro },
      { path: '/srtm/visor/vias', status: 502, body: { title: 'Bad Gateway', status: 502 } }
    ])
    expect(await screen.findByText('Catastro no está configurado para esta municipalidad.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Vías con arancel/ }))
    expect(await screen.findByText('No se pudieron leer las vías de catastro.')).toBeInTheDocument()
    // the rest of the visor is there
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(llamadas('/srtm/visor/vias')).toHaveLength(1)
  })

  it('exports the rows of the filters as CSV, under the backend’s name', async () => {
    const descargas: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargas.push(`${this.download} ${this.href}`)
    })
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:visor'), revokeObjectURL: vi.fn() })
    start('/brecha/visor')
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    const filtros = screen.getByRole('search', { name: 'Filtros de los predios' })
    await userEvent.click(within(within(filtros).getByRole('group', { name: 'Confianza' })).getByRole('button', { name: 'Dudoso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(llamadas('/srtm/visor/predios.csv')).toEqual([`/srtm/visor/predios.csv?anio=${year}&confianza=DUDOSO&orden=delta_desc`]))
    const csv = fetch!.calls.find((c) => c.path.startsWith('/srtm/visor/predios.csv'))!
    expect(csv.headers.authorization).toBe('Bearer t')
    await waitFor(() => expect(descargas).toEqual(['srtm-visor-predios.csv blob:visor']))
  })

  it('reads the corrida of the url, the same for the panel, the rows and the lotes', async () => {
    start(`/brecha/visor?anio=${year}&corrida=c1`)
    await screen.findByRole('region', { name: 'Indicadores de la corrida' })
    expect(llamadas('/srtm/visor/panel')[0]).toBe(`/srtm/visor/panel?anio=${year}&corrida=c1`)
    await waitFor(() => expect(llamadas('/srtm/visor/lotes')[0]).toBe(`/srtm/visor/lotes?anio=${year}&corrida=c1`))
    expect(llamadas('/srtm/visor/predios')[0]).toContain(`anio=${year}&corrida=c1&`)
    expect(mapa()).toHaveAttribute('data-clave', `${year}|c1`)
  })
})
