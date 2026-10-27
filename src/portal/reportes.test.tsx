import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { LotesMapProps } from './components/LotesMap'
import { PortalApp } from './PortalApp'

// los reportes de brechas (wasichai/srtm-ui#150), sobre el contrato de srtm-backend#248 (/srtm/reportes): un tablero
// de inicio con los agregados de la corrida y una página por reporte con filtros, orden, paginación y exportación a
// xlsx y csv. todas las cifras son del backend

// jsdom has no webgl: the map tells what it was handed
vi.mock('./components/LotesMap', () => ({
  LotesMap: ({ features, label }: LotesMapProps) => (
    <div data-testid="lotes-map" aria-label={label} data-ids={JSON.stringify(features?.features.map((f) => f.id) ?? null)} />
  )
}))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const corrida = (id: string, terminado: string, estado = 'TERMINADA') => ({
  id,
  anio: year,
  estado,
  versionCatastro: 'valuacion-v2',
  iniciado: terminado,
  terminado: estado === 'TERMINADA' ? terminado : null,
  totalPredios: 4,
  procesados: 4,
  mensaje: null,
  declarado: null,
  catastro: null,
  deltaImpuesto: null,
  deltaArbitrios: null
})
const corridas = [corrida('c3', `${year}-10-22T15:00:00Z`, 'EN_CURSO'), corrida('c2', `${year}-10-20T15:00:00Z`), corrida('c1', `${year}-10-10T15:00:00Z`)]

const resumen = {
  corrida: { id: 'c2', anio: year, terminado: `${year}-10-20T15:00:00Z`, versionCatastro: 'valuacion-v2' },
  kpis: {
    prediosCatastro: 1200,
    prediosPadron: 1100,
    omisos: 80,
    subvaluados: 300,
    sobrevaluados: 40,
    coinciden: 600,
    sinCatastro: 20,
    sinValor: 10,
    sinLevantar: 150,
    autoavaluoDeclarado: 1000000,
    autoavaluoCatastro: 1500000,
    deltaAutoavaluo: 500000,
    deltaImpuesto: 12345.67,
    deltaArbitrios: null
  },
  porCategoria: [
    { categoria: 'OMISO', predios: 80, deltaAutoavaluo: 200000, deltaImpuesto: 3000 },
    { categoria: 'SUBVALUADO', predios: 300, deltaAutoavaluo: 350000, deltaImpuesto: 9800 },
    { categoria: 'SOBREVALUADO', predios: 40, deltaAutoavaluo: -50000, deltaImpuesto: -454.33 }
  ],
  porConfianza: [
    { confianza: 'CONFIABLE', predios: 700, deltaAutoavaluo: 300000, deltaImpuesto: 9000 },
    { confianza: 'DUDOSO', predios: 350, deltaAutoavaluo: 200000, deltaImpuesto: 3345.67 }
  ],
  porSector: [
    { sector: '01', predios: 600, deltaAutoavaluo: 400000, deltaImpuesto: 10000 },
    { sector: '02', predios: 400, deltaAutoavaluo: -20000, deltaImpuesto: -300 },
    { sector: null, predios: 5, deltaAutoavaluo: 0, deltaImpuesto: 0 }
  ],
  porUso: [
    { uso: '010101', descripcion: 'Casa habitación', predios: 900, deltaAutoavaluo: 450000, deltaImpuesto: 11000 },
    { uso: '020101', descripcion: 'Comercio', predios: 100, deltaAutoavaluo: 50000, deltaImpuesto: 1345.67 }
  ],
  porManzana: [{ sector: '01', manzana: 'A', predios: 40, deltaAutoavaluo: 90000, deltaImpuesto: 2500 }],
  histogramaDeltaAutoavaluo: [
    { desde: null, hasta: -10000, predios: 5 },
    { desde: -10000, hasta: 0, predios: 35 },
    { desde: 0, hasta: 10000, predios: 200 },
    { desde: 10000, hasta: null, predios: 100 }
  ],
  areas: {
    terrenoConDiferencia: 210,
    terrenoCatastralMayor: 150,
    nivelesComparados: 800,
    prediosConNivelMayor: 95,
    deltaM2Terreno: 15234.5,
    deltaM2Niveles: 8420.25
  },
  decisiones: { PENDIENTE: 120, A_INSPECCIONAR: 30, A_FISCALIZAR: 8, DESCARTADO: 2 },
  avisos: []
}

const catalogo = [
  {
    clave: 'subvaluados',
    titulo: 'Predios subvaluados',
    descripcion: 'Declaran menos que el catastro',
    predios: 300,
    deltaImpuesto: 9800,
    deltaAutoavaluo: 350000
  },
  { clave: 'omisos', titulo: 'Omisos', descripcion: 'En catastro, sin declaración', predios: 80, deltaImpuesto: 3000, deltaAutoavaluo: 200000 },
  {
    clave: 'contribuyentes',
    titulo: 'Contribuyentes con mayor brecha',
    descripcion: 'La suma de Δ de sus predios',
    predios: 250,
    deltaImpuesto: 12345.67,
    deltaAutoavaluo: 500000
  }
]

const predio = (valores: Record<string, unknown>) => ({
  id: 'b1',
  predio: 'p1',
  codigoPredio: '01-01-0001',
  codigoCatastro: 'PM-1',
  contribuyente: 'k1',
  codigoContribuyente: '000123',
  nombreContribuyente: 'QUISPE MAMANI, JUAN',
  declaracion: 'd1',
  sector: '01',
  manzana: 'A',
  lote: '1',
  uso: '010101',
  usoDescripcion: 'Casa habitación',
  categoria: 'SUBVALUADO',
  confianza: 'CONFIABLE',
  autoavaluoDeclarado: 100000,
  autoavaluoCatastro: 150000,
  deltaAutoavaluo: 50000,
  impuestoDeclarado: 330,
  impuestoCatastro: 630,
  deltaImpuesto: 300,
  areaTerrenoDeclarada: 200,
  areaTerrenoCatastro: 240.5,
  areaConstruidaDeclarada: 120,
  areaConstruidaCatastro: 180,
  decision: 'A_INSPECCIONAR',
  ...valores
})

const subvaluados = {
  page: 0,
  size: 20,
  total: 2,
  items: [
    predio({}),
    predio({
      id: 'b2',
      predio: null,
      codigoPredio: null,
      codigoCatastro: 'PM-2',
      contribuyente: null,
      codigoContribuyente: null,
      nombreContribuyente: null,
      declaracion: null,
      lote: '2',
      confianza: 'DUDOSO',
      decision: null
    })
  ]
}

const contribuyentes = {
  page: 0,
  size: 20,
  total: 1,
  items: [
    {
      contribuyente: 'k1',
      codigoContribuyente: '000123',
      nombreContribuyente: 'QUISPE MAMANI, JUAN',
      predios: 3,
      deltaAutoavaluo: 90000,
      deltaImpuesto: 640.5
    }
  ]
}

const lotes = {
  type: 'FeatureCollection',
  features: ['b1', 'b2', 'b9'].map((id) => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-75.22, -10.95] },
    properties: { categoria: 'SUBVALUADO', codigo: id, deltaImpuesto: 1 }
  }))
}

const base = (permisos: unknown): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } },
  { path: '/srtm/brecha/corridas', body: corridas },
  { path: `/srtm/brecha/${year}/lotes`, body: lotes },
  { path: '/srtm/reportes/resumen', body: resumen },
  { path: '/srtm/reportes/subvaluados', body: subvaluados },
  { path: '/srtm/reportes/contribuyentes', body: contribuyentes },
  { path: '/srtm/reportes', body: catalogo }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
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
    .map((li) => li.textContent?.replace(/\u00a0/g, ' '))
const filas = (nombre: string): HTMLTableRowElement[] =>
  within(screen.getByRole('table', { name: nombre }))
    .getAllByRole<HTMLTableRowElement>('row')
    .slice(1)
const tarjeta = (label: string) => screen.getByText(label, { selector: 'p' }).parentElement!

describe('tablero de reportes de brechas', () => {
  it('is reached from the menu', async () => {
    start('/')
    const menu = await screen.findByRole('navigation', { name: 'Secciones' })
    // the entry reads brecha_corrida: it is there once the permissions are
    await userEvent.click(await within(menu).findByRole('link', { name: 'Reportes de brechas' }))
    expect(await screen.findByRole('heading', { name: 'Reportes de brechas' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/reportes')
  })

  it('asks for the latest TERMINADA corrida of the year and shows its KPIs', async () => {
    start('/reportes')
    await screen.findByRole('region', { name: 'Indicadores de la brecha' })
    expect(llamadas('/srtm/reportes/resumen')[0]).toBe(`/srtm/reportes/resumen?anio=${year}`)
    expect(llamadas('/srtm/reportes')[0]).toBe(`/srtm/reportes?anio=${year}`)
    expect(tarjeta('Predios en catastro')).toHaveTextContent('1,200')
    expect(tarjeta('Predios en catastro')).toHaveTextContent('al 20/10/')
    expect(tarjeta('Subvaluados')).toHaveTextContent('300')
    expect(tarjeta('Δ impuesto predial')).toHaveTextContent('S/ 12,345.67')
    expect(tarjeta('Δ autoavalúo')).toHaveTextContent('S/ 500,000.00')
    expect(screen.getByRole('region', { name: 'Corrida' })).toHaveTextContent('valuacion-v2')
  })

  it('offers only the TERMINADA corridas, and a picked one is asked for by its id', async () => {
    start('/reportes')
    const selector = await screen.findByRole('combobox', { name: 'Corrida' })
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(3))
    const opciones = within(selector).getAllByRole('option')
    expect(opciones.map((o) => o.getAttribute('value'))).toEqual(['', 'c2', 'c1'])
    expect(opciones[0]).toHaveTextContent('Última terminada')
    await userEvent.selectOptions(selector, 'c1')
    await waitFor(() => expect(llamadas('/srtm/reportes/resumen').at(-1)).toBe(`/srtm/reportes/resumen?anio=${year}&corrida=c1`))
    expect(llamadas('/srtm/reportes').at(-1)).toBe(`/srtm/reportes?anio=${year}&corrida=c1`)
    expect(window.location.search).toBe(`?anio=${year}&corrida=c1`)
  })

  it('draws a bar per categoría, confianza, sector and uso, and the histogram of Δ autoavalúo', async () => {
    start('/reportes')
    await screen.findByRole('list', { name: 'Por categoría' })
    expect(barras('Por categoría')).toEqual(['Omisos80 · S/ 3,000.00', 'Subvaluados300 · S/ 9,800.00', 'Sobrevaluados40 · -S/ 454.33'])
    expect(barras('Por confianza')).toEqual(['Confiable700 · S/ 9,000.00', 'Dudoso350 · S/ 3,345.67'])
    expect(barras('Por sector')).toEqual(['Sector 01600 · S/ 10,000.00', 'Sector 02400 · -S/ 300.00', 'Sin sector5 · S/ 0.00'])
    expect(barras('Por uso')).toEqual(['Casa habitación900 · S/ 11,000.00', 'Comercio100 · S/ 1,345.67'])
    expect(barras('Manzanas con más Δ impuesto')).toEqual(['01-A40 · S/ 2,500.00'])

    // the categorías in BrechaPage's colours; a bar as long as its share of the longest
    const subvaluado = screen.getByTestId('barra-categoria-SUBVALUADO')
    expect(subvaluado).toHaveStyle({ width: '100%' })
    expect(subvaluado.style.background).toBe('var(--warning)')
    expect(screen.getByTestId('barra-categoria-OMISO').style.background).toBe('var(--danger)')
    expect(screen.getByTestId('barra-confianza-CONFIABLE').style.background).toBe('var(--success)')
    // a sector that would pay more in red, less in the brand's colour: catastro-ui's diverging sides
    expect(screen.getByTestId('barra-sector-01').style.background).toBe('var(--danger)')
    expect(screen.getByTestId('barra-sector-02').style.background).toBe('var(--brand)')

    const histograma = screen.getByRole('list', { name: 'Histograma de Δ autoavalúo' })
    expect(
      within(histograma)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label')?.replace(/\u00a0/g, ' '))
    ).toEqual([
      'Menos de -S/ 10,000.00: 5 predios',
      '-S/ 10,000.00 a S/ 0.00: 35 predios',
      'S/ 0.00 a S/ 10,000.00: 200 predios',
      'S/ 10,000.00 o más: 100 predios'
    ])
  })

  it('shows the areas, the decisions of catastro and a card per report with its link', async () => {
    start(`/reportes?anio=${year}&corrida=c2`)
    const areas = await screen.findByRole('region', { name: 'Áreas' })
    expect(within(areas).getByText('Terreno con diferencia').nextSibling).toHaveTextContent('210')
    expect(within(areas).getByText('Δ m² de terreno').nextSibling).toHaveTextContent('15,234.50')
    expect(within(areas).getByText('Δ m² de niveles').nextSibling).toHaveTextContent('8,420.25')

    expect(barras('Decisiones de catastro')).toEqual(['Pendiente120', 'A inspeccionar30', 'A fiscalizar8', 'Descartado2'])

    const reportes = await screen.findByRole('region', { name: 'Reportes' })
    const [primero, , tercero] = within(reportes).getAllByRole('article')
    expect(within(primero).getByRole('link', { name: 'Predios subvaluados' })).toHaveAttribute('href', `/reportes/subvaluados?anio=${year}&corrida=c2`)
    expect(primero).toHaveTextContent('Declaran menos que el catastro')
    expect(primero).toHaveTextContent('300 predios')
    expect(primero).toHaveTextContent('Δ impuesto S/ 9,800.00')
    expect(primero).toHaveTextContent('Δ autoavalúo S/ 350,000.00')
    expect(tercero).toHaveTextContent('250 contribuyentes')
  })

  it('says catastro could not be read when the decisions come null, with the backend’s notices', async () => {
    start('/reportes', [
      { path: '/srtm/reportes/resumen', body: { ...resumen, decisiones: null, avisos: ['Catastro no respondió: las decisiones no se muestran'] } }
    ])
    const decisiones = await screen.findByRole('region', { name: 'Decisiones de catastro' })
    expect(decisiones).toHaveTextContent('Sin datos de catastro')
    expect(screen.getByRole('region', { name: 'Avisos' })).toHaveTextContent('Catastro no respondió: las decisiones no se muestran')
  })

  it('says when the year has no TERMINADA corrida', async () => {
    start('/reportes', [
      { path: '/srtm/reportes/resumen', status: 404, body: { title: 'Not Found', status: 404 } },
      { path: '/srtm/reportes', status: 404, body: { title: 'Not Found', status: 404 } }
    ])
    expect(await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'brecha de recaudación' })).toHaveAttribute('href', '/brecha')
  })

  it('asks nothing without READ on the corridas de brecha', async () => {
    start('/reportes', [], { admin: false, objects: {} })
    expect(await screen.findByText(/Sin permiso para ver los reportes/)).toBeInTheDocument()
    expect(llamadas('/srtm/reportes/resumen')).toHaveLength(0)
  })
})

describe('página de un reporte', () => {
  it('lists the predios with links to the predio, the DJ and the contribuyente', async () => {
    start(`/reportes/subvaluados?anio=${year}&corrida=c2`)
    expect(await screen.findByRole('heading', { name: 'Predios subvaluados' })).toBeInTheDocument()
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    expect(llamadas('/srtm/reportes/subvaluados')[0]).toBe(`/srtm/reportes/subvaluados?anio=${year}&corrida=c2&page=0&size=20`)

    const [uno, dos] = filas('Predios subvaluados')
    expect(within(uno).getByRole('link', { name: '01-01-0001' })).toHaveAttribute('href', '/predios/p1')
    expect(within(uno).getByRole('link', { name: 'QUISPE MAMANI, JUAN' })).toHaveAttribute('href', '/contribuyentes/k1')
    expect(within(uno).getByRole('link', { name: 'DJ' })).toHaveAttribute('href', '/declaraciones/d1')
    expect(uno).toHaveTextContent('01-A-1')
    expect(uno).toHaveTextContent('Casa habitación')
    expect(uno).toHaveTextContent('Subvaluado')
    expect(uno).toHaveTextContent('Confiable')
    expect(uno).toHaveTextContent('S/ 100,000.00')
    expect(uno).toHaveTextContent('S/ 150,000.00')
    expect(uno).toHaveTextContent('S/ 50,000.00')
    expect(uno).toHaveTextContent('S/ 300.00')
    expect(uno).toHaveTextContent('240.50')
    expect(uno).toHaveTextContent('A inspeccionar')
    // an omiso has no srtm predio, no DJ and no contribuyente to open
    expect(within(dos).queryAllByRole('link')).toHaveLength(0)
    expect(dos).toHaveTextContent('PM-2')
    expect(screen.getByRole('link', { name: /Volver a los reportes/ })).toHaveAttribute('href', `/reportes?anio=${year}&corrida=c2`)
  })

  it('filters by sector, manzana, uso, confianza and a text, from the first page', async () => {
    start(`/reportes/subvaluados?anio=${year}`)
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    // the sectores and usos of the corrida, from its resumen
    const sector = await screen.findByRole('combobox', { name: 'Sector' })
    await waitFor(() =>
      expect(
        within(sector)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual(['Todos', '01', '02'])
    )
    await userEvent.selectOptions(sector, '01')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Uso' }), '020101')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Confianza' }), 'DUDOSO')
    await userEvent.type(screen.getByRole('textbox', { name: 'Manzana' }), 'B')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Código o nombre' }), 'quispe')
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() =>
      expect(llamadas('/srtm/reportes/subvaluados').at(-1)).toBe(
        `/srtm/reportes/subvaluados?anio=${year}&sector=01&manzana=B&uso=020101&confianza=DUDOSO&q=quispe&page=0&size=20`
      )
    )
  })

  it('sorts by a column, flipping the direction on a second press', async () => {
    start(`/reportes/subvaluados?anio=${year}`)
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    const columna = () => screen.getByRole('columnheader', { name: /Δ impuesto/ })
    expect(columna()).toHaveAttribute('aria-sort', 'none')
    await userEvent.click(within(columna()).getByRole('button'))
    await waitFor(() =>
      expect(llamadas('/srtm/reportes/subvaluados').at(-1)).toBe(`/srtm/reportes/subvaluados?anio=${year}&orden=deltaImpuesto&dir=desc&page=0&size=20`)
    )
    expect(columna()).toHaveAttribute('aria-sort', 'descending')
    await userEvent.click(within(columna()).getByRole('button'))
    await waitFor(() =>
      expect(llamadas('/srtm/reportes/subvaluados').at(-1)).toBe(`/srtm/reportes/subvaluados?anio=${year}&orden=deltaImpuesto&dir=asc&page=0&size=20`)
    )
    expect(columna()).toHaveAttribute('aria-sort', 'ascending')
    // the code goes up first
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Código/ })).getByRole('button'))
    await waitFor(() => expect(llamadas('/srtm/reportes/subvaluados').at(-1)).toContain('orden=codigo&dir=asc'))
  })

  it('pages with the backend’s total', async () => {
    start(`/reportes/subvaluados?anio=${year}`, [{ path: '/srtm/reportes/subvaluados', body: { ...subvaluados, total: 45 } }])
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => expect(llamadas('/srtm/reportes/subvaluados').at(-1)).toBe(`/srtm/reportes/subvaluados?anio=${year}&page=1&size=20`))
  })

  it.each([
    ['XLSX', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['CSV', 'csv', 'text/csv']
  ])('exports to %s with the same filters and the backend’s file name', async (boton, extension, tipo) => {
    start(`/reportes/subvaluados?anio=${year}&corrida=c2&sector=01&orden=deltaImpuesto&dir=desc&page=2`)
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    // mockFetch answers json only: the file comes from here, like the backend sends it
    const mocked = globalThis.fetch
    const pedidos: { url: string; auth: string | null }[] = []
    globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input)
      if (!url.includes(`/subvaluados.${extension}`)) return mocked(input, init)
      pedidos.push({ url, auth: new Headers(init.headers).get('Authorization') })
      return new Response('archivo', {
        status: 200,
        headers: { 'Content-Type': tipo, 'Content-Disposition': `attachment; filename="subvaluados-${year}.${extension}"` }
      })
    }
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:reporte'), revokeObjectURL: vi.fn() })
    const descargas: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargas.push(`${this.download} ${this.getAttribute('href')}`)
    })

    await userEvent.click(screen.getByRole('button', { name: `Exportar ${boton}` }))

    await waitFor(() => expect(descargas).toEqual([`subvaluados-${year}.${extension} blob:reporte`]))
    // every row of the filter, not one page of it
    expect(pedidos).toEqual([
      { url: `/api/srtm/reportes/subvaluados.${extension}?anio=${year}&corrida=c2&sector=01&orden=deltaImpuesto&dir=desc`, auth: 'Bearer t' }
    ])
  })

  it('says why an export failed', async () => {
    start(`/reportes/subvaluados?anio=${year}`, [
      { path: '/srtm/reportes/subvaluados.csv', status: 500, body: { title: 'Error', status: 500, detail: 'Falló la exportación' } }
    ])
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la exportación')
  })

  it('shows the lotes of the rows on the map when asked', async () => {
    start(`/reportes/subvaluados?anio=${year}`)
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    expect(screen.queryByTestId('lotes-map')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver en el mapa' }))
    const mapa = await screen.findByTestId('lotes-map')
    // the corrida the resumen names, and only the rows of the page
    await waitFor(() => expect(mapa).toHaveAttribute('data-ids', JSON.stringify(['b1', 'b2'])))
    expect(llamadas(`/srtm/brecha/${year}/lotes`)[0]).toBe(`/srtm/brecha/${year}/lotes?corrida=c2`)
  })

  it('says a report the catalog does not have is not there, not that the brecha is not calculated', async () => {
    start(`/reportes/foo?anio=${year}`, [{ path: '/srtm/reportes/foo', status: 404, body: { title: 'Not Found', status: 404 } }])
    expect(await screen.findByText('Reporte no encontrado')).toBeInTheDocument()
    expect(screen.queryByText(`Aún no se ha calculado la brecha de ${year}`)).not.toBeInTheDocument()
  })

  it('keeps what was typed in the filters when sorting, and takes a page size it offers', async () => {
    start(`/reportes/subvaluados?anio=${year}&size=100000`)
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    expect(llamadas('/srtm/reportes/subvaluados')[0]).toBe(`/srtm/reportes/subvaluados?anio=${year}&page=0&size=20`)
    await userEvent.type(screen.getByRole('textbox', { name: 'Manzana' }), 'B')
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Δ impuesto/ })).getByRole('button'))
    await waitFor(() => expect(llamadas('/srtm/reportes/subvaluados').at(-1)).toContain('orden=deltaImpuesto'))
    expect(screen.getByRole('textbox', { name: 'Manzana' })).toHaveValue('B')
  })

  it('shows a sector of the url the resumen does not list', async () => {
    start(`/reportes/subvaluados?anio=${year}&sector=09`)
    await screen.findByRole('table', { name: 'Predios subvaluados' })
    expect(screen.getByRole('combobox', { name: 'Sector' })).toHaveValue('09')
  })

  it('lists the contribuyentes, each with the sum of its predios', async () => {
    start(`/reportes/contribuyentes?anio=${year}`)
    await screen.findByRole('table', { name: 'Contribuyentes con mayor brecha' })
    const [fila] = filas('Contribuyentes con mayor brecha')
    expect(within(fila).getByRole('link', { name: 'QUISPE MAMANI, JUAN' })).toHaveAttribute('href', '/contribuyentes/k1')
    expect(fila).toHaveTextContent('000123')
    expect(fila).toHaveTextContent('3')
    expect(fila).toHaveTextContent('S/ 640.50')
    expect(screen.queryByRole('button', { name: 'Ver en el mapa' })).not.toBeInTheDocument()
  })
})
