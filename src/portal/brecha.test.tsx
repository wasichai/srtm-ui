import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { LotesMapProps } from './components/LotesMap'
import { PortalApp } from './PortalApp'

// la brecha de recaudación de un año (padrón frente a catastro): se calcula una corrida en segundo plano, se sigue su
// avance y, al terminar, el panel muestra los indicadores, las tablas por categoría y por sector, los predios filtrados
// y el mapa de lotes por categoría. todas las cifras son del backend (srtm-backend /srtm/brecha)

// jsdom has no webgl: the map tells what it was handed
vi.mock('./components/LotesMap', () => ({
  LotesMap: ({ features, colorPor, label }: LotesMapProps) => (
    <div data-testid="lotes-map" aria-label={label} data-lotes={features?.features.length ?? 0} data-color-por={JSON.stringify(colorPor ?? null)} />
  )
}))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const corrida = (valores: Record<string, unknown>) => ({
  id: 'c1',
  anio: year,
  estado: 'PENDIENTE',
  versionCatastro: null,
  iniciado: `${year}-10-19T15:00:00Z`,
  terminado: null,
  totalPredios: 0,
  procesados: 0,
  mensaje: null,
  declarado: null,
  catastro: null,
  deltaImpuesto: null,
  deltaArbitrios: null,
  ...valores
})

const terminada = corrida({
  estado: 'TERMINADA',
  versionCatastro: 'valuacion-v1',
  terminado: `${year}-10-19T15:01:30Z`,
  totalPredios: 4,
  procesados: 4,
  mensaje: `Δ arbitrios no calculado: faltan Ordenanza de arbitrios ${year}`
})

const fila = (categoria: string, predios: number, deltaImpuesto: number | null) => ({
  categoria,
  predios,
  deltaAutoavaluo: deltaImpuesto === null ? null : deltaImpuesto * 100,
  deltaImpuesto,
  deltaArbitrios: null
})

const panel = {
  corrida: { id: 'c1', terminado: `${year}-10-19T15:01:30Z`, versionCatastro: 'valuacion-v1' },
  kpis: {
    prediosCatastro: 4,
    prediosPadron: 3,
    omisos: 1,
    subvaluados: 1,
    sobrevaluados: 0,
    coinciden: 1,
    sinCatastro: 1,
    sinValor: 0,
    sinLevantar: 1,
    autoavaluoDeclarado: 180000,
    autoavaluoCatastro: 270000,
    deltaAutoavaluo: 90000,
    deltaImpuesto: 1234.56,
    deltaArbitrios: null,
    deltaImpuestoOmisosEstimado: 240,
    autoavaluoDeclaradoTotal: 250000,
    autoavaluoCatastroTotal: 270000
  },
  porCategoria: [
    fila('OMISO', 1, 240),
    fila('SIN_CATASTRO', 1, null),
    fila('SIN_VALOR', 0, null),
    fila('SUBVALUADO', 1, 994.56),
    fila('SOBREVALUADO', 0, 0),
    fila('COINCIDE', 1, 0),
    fila('SIN_LEVANTAR', 1, 0)
  ],
  porConfianza: {
    CONFIABLE: { predios: 2, deltaImpuesto: 994.56, deltaAutoavaluo: 50000 },
    DUDOSO: { predios: 1, deltaImpuesto: 240, deltaAutoavaluo: 40000 },
    SIN_LEVANTAR: { predios: 1, deltaImpuesto: 0, deltaAutoavaluo: 0 }
  },
  porSector: [
    { sector: '01', predios: 3, deltaImpuesto: 1234.56, deltaArbitrios: null, omisos: 1, subvaluados: 1 },
    { sector: null, predios: 1, deltaImpuesto: null, deltaArbitrios: null, omisos: 0, subvaluados: 0 }
  ]
}

const predios = {
  content: [
    {
      id: 'b1',
      predio: 'p1',
      codigoPredio: '01-01-0001',
      codigoCatastro: 'PM-1',
      categoria: 'SUBVALUADO',
      sector: '01',
      manzana: 'A',
      lote: '1',
      uso: '010101',
      autoavaluoDeclarado: 100000,
      autoavaluoCatastro: 150000,
      deltaAutoavaluo: 50000,
      impuestoDeclarado: 330,
      impuestoCatastro: 630,
      deltaImpuesto: 300,
      deltaArbitrios: 42,
      estimado: false,
      motivo: null,
      confianza: 'CONFIABLE',
      confianzaMotivo: 'Vínculo por código de rentas'
    },
    {
      id: 'b2',
      predio: null,
      codigoPredio: null,
      codigoCatastro: 'PM-2',
      categoria: 'OMISO',
      sector: '01',
      manzana: 'A',
      lote: '2',
      uso: null,
      autoavaluoDeclarado: null,
      autoavaluoCatastro: 40000,
      deltaAutoavaluo: 40000,
      impuestoDeclarado: null,
      impuestoCatastro: 240,
      deltaImpuesto: 240,
      deltaArbitrios: null,
      estimado: true,
      motivo: null,
      confianza: 'SIN_LEVANTAR',
      confianzaMotivo: 'Ficha sin levantar (entrega E3)'
    }
  ],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
  nextCursor: null
}

const lotes = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'b1',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-75.22, -10.95],
            [-75.221, -10.95],
            [-75.221, -10.951],
            [-75.22, -10.95]
          ]
        ]
      },
      properties: { categoria: 'SUBVALUADO', codigo: '01-01-0001', deltaImpuesto: 300 }
    }
  ]
}

const resultados: MockRoute[] = [
  { path: `/srtm/brecha/${year}/panel`, body: panel },
  { path: `/srtm/brecha/${year}/predios`, body: predios },
  { path: `/srtm/brecha/${year}/lotes`, body: lotes }
]

const base = (permisos: unknown): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// lista: the route of GET /srtm/brecha/corridas, whose body a test changes as the backend's corrida moves on
function start(path: string, lista: MockRoute, extra: MockRoute[] = [], permisos: unknown = { admin: true, objects: {} }) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, lista, ...resultados, ...base(permisos)])
  render(<PortalApp />)
}

const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const filasDe = (nombre: string): HTMLTableRowElement[] =>
  within(screen.getByRole('table', { name: nombre }))
    .getAllByRole<HTMLTableRowElement>('row')
    .slice(1)
const tarjeta = (label: string) => screen.getByText(label, { selector: 'p' }).parentElement!

describe('brecha de recaudación', () => {
  it('is reached from the menu', async () => {
    start('/', { path: '/srtm/brecha/corridas', body: [] })
    const menu = await screen.findByRole('navigation', { name: 'Secciones' })
    await userEvent.click(within(menu).getByRole('link', { name: 'Brecha de recaudación' }))
    expect(await screen.findByRole('heading', { name: 'Brecha de recaudación' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/brecha')
  })

  it('says when the year has no brecha yet, asking for no panel', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [] })
    expect(await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)).toBeInTheDocument()
    expect(llamadas('GET', '/srtm/brecha/corridas')[0].path).toBe(`/srtm/brecha/corridas?anio=${year}`)
    expect(llamadas('GET', `/srtm/brecha/${year}/panel`)).toHaveLength(0)
  })

  it('shows the KPIs, the tables by categoría and by sector, the predios and the map of the latest TERMINADA corrida', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [terminada] })
    await screen.findByRole('region', { name: 'Indicadores de la brecha' })

    // panel, rows and lotes all of the same corrida
    expect(llamadas('GET', `/srtm/brecha/${year}/panel`)[0].path).toBe(`/srtm/brecha/${year}/panel?corrida=c1`)
    await waitFor(() => expect(llamadas('GET', `/srtm/brecha/${year}/lotes`)[0]?.path).toBe(`/srtm/brecha/${year}/lotes?corrida=c1`))

    expect(tarjeta('Predios en catastro')).toHaveTextContent('4')
    expect(tarjeta('Predios en catastro')).toHaveTextContent('al 19/10/')
    expect(tarjeta('Predios en el padrón')).toHaveTextContent('3')
    expect(tarjeta('Omisos')).toHaveTextContent('1')
    expect(tarjeta('Sobrevaluados')).toHaveTextContent('0')
    expect(tarjeta('Sin catastro')).toHaveTextContent('1')
    expect(tarjeta('Sin levantar')).toHaveTextContent('1')
    expect(tarjeta('Sin levantar')).toHaveTextContent('Ficha del catastro sin levantamiento')
    expect(tarjeta('Δ autoavalúo')).toHaveTextContent('S/ 90,000.00')
    // the three figures reconcile: 180,000 + 90,000 = 270,000
    expect(tarjeta('Δ autoavalúo')).toHaveTextContent('Declarado S/ 180,000.00 · catastro S/ 270,000.00 (predios comparados y omisos)')
    expect(tarjeta('Δ impuesto predial')).toHaveTextContent('S/ 1,234.56')
    expect(tarjeta('Δ impuesto predial')).toHaveTextContent('Neto (subvaluados − sobrevaluados) + omisos estimados (S/ 240.00)')
    // no Δ arbitrios is never a 0: the corrida's mensaje says why
    expect(tarjeta('Δ arbitrios')).toHaveTextContent('No calculado')
    expect(tarjeta('Δ arbitrios')).toHaveTextContent('faltan Ordenanza de arbitrios')

    const categorias = filasDe('Brecha por categoría')
    expect(categorias.map((f) => f.cells[0].textContent)).toEqual([
      'Omisos',
      'Sin catastro',
      'Sin valor',
      'Subvaluados',
      'Sobrevaluados',
      'Coinciden',
      'Sin levantar'
    ])
    expect(categorias[3]).toHaveTextContent('S/ 994.56')
    expect(categorias[1].cells[3]).toHaveTextContent('—')

    const sectores = filasDe('Brecha por sector')
    expect(sectores[0]).toHaveTextContent('Sector 01')
    expect(sectores[0]).toHaveTextContent('S/ 1,234.56')
    expect(sectores[1]).toHaveTextContent('Sin sector')
    expect(within(sectores[1]).queryByRole('button')).not.toBeInTheDocument()

    const predio = (await screen.findAllByRole('row')).find((r) => r.textContent?.includes('01-01-0001'))!
    expect(within(predio).getByRole('link', { name: '01-01-0001' })).toHaveAttribute('href', '/predios/p1')
    expect(predio).toHaveTextContent('Subvaluado')
    expect(predio).toHaveTextContent('01-A-1')
    expect(predio).toHaveTextContent('S/ 100,000.00')
    expect(predio).toHaveTextContent('S/ 150,000.00')
    expect(predio).toHaveTextContent('S/ 300.00')
    // an omiso has no srtm predio to open; its Δ is an estimate
    const omiso = filasDe('Predios de la brecha')[1]
    expect(within(omiso).queryByRole('link')).not.toBeInTheDocument()
    expect(omiso).toHaveTextContent('PM-2')
    expect(omiso).toHaveTextContent('estimado')

    const mapa = screen.getByTestId('lotes-map')
    await waitFor(() => expect(mapa).toHaveAttribute('data-lotes', '1'))
    expect(JSON.parse(mapa.getAttribute('data-color-por')!)).toEqual({
      propiedad: 'categoria',
      colores: {
        OMISO: 'var(--danger)',
        SIN_CATASTRO: 'var(--ink-muted)',
        SIN_VALOR: 'var(--ink)',
        SUBVALUADO: 'var(--warning)',
        SOBREVALUADO: 'var(--brand)',
        COINCIDE: 'var(--success)',
        SIN_LEVANTAR: 'color-mix(in oklch, var(--brand), var(--danger))'
      }
    })
    expect(
      within(screen.getByRole('list', { name: 'Leyenda' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['Omisos', 'Sin catastro', 'Sin valor', 'Subvaluados', 'Sobrevaluados', 'Coinciden', 'Sin levantar'])
  })

  it('shows the brecha by confianza, the confiable one first and highlighted, and each row its confianza', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [terminada] })
    const seccion = await screen.findByRole('region', { name: 'Brecha por confianza' })
    const confianzas = within(seccion).getAllByRole('article')
    expect(confianzas.map((c) => within(c).getByRole('button').textContent)).toEqual(['Confiable', 'Dudoso', 'Sin levantar'])

    // the confiable figure is the one that can be defended: first, and marked as such
    const [confiable, dudoso, sinLevantar] = confianzas
    expect(confiable).toHaveAttribute('data-destacada', 'true')
    expect(dudoso).not.toHaveAttribute('data-destacada')
    expect(confiable).toHaveTextContent('Vínculo por código de rentas, manual revisado o titular coincidente')
    expect(confiable).toHaveTextContent('2 predios')
    expect(confiable).toHaveTextContent('S/ 994.56')
    expect(confiable).toHaveTextContent('Δ autoavalúo S/ 50,000.00')
    expect(dudoso).toHaveTextContent('Sin vínculo confirmado')
    expect(dudoso).toHaveTextContent('1 predio')
    expect(dudoso).toHaveTextContent('S/ 240.00')
    expect(sinLevantar).toHaveTextContent('Ficha del catastro sin levantamiento')

    await screen.findByRole('table', { name: 'Predios de la brecha' })
    const [primera, segunda] = filasDe('Predios de la brecha')
    expect(within(primera).getByText('Confiable')).toBeInTheDocument()
    expect(primera).toHaveTextContent('Vínculo por código de rentas')
    expect(within(segunda).getByText('Sin levantar')).toBeInTheDocument()
    expect(segunda).toHaveTextContent('Ficha sin levantar (entrega E3)')
  })

  it('filters the predios by a confianza, and clears it', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [terminada] })
    const seccion = await screen.findByRole('region', { name: 'Brecha por confianza' })
    await screen.findByRole('table', { name: 'Predios de la brecha' })

    await userEvent.click(within(seccion).getByRole('button', { name: 'Dudoso' }))
    await waitFor(() =>
      expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toBe(`/srtm/brecha/${year}/predios?confianza=DUDOSO&page=0&size=20&corrida=c1`)
    )
    expect(within(seccion).getByRole('button', { name: 'Dudoso' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro de confianza Dudoso' }))
    await waitFor(() => expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toBe(`/srtm/brecha/${year}/predios?page=0&size=20&corrida=c1`))
    expect(within(seccion).getByRole('button', { name: 'Dudoso' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a panel from before the confianza without its section', async () => {
    const { porConfianza: _, ...anterior } = panel
    const { sinLevantar: __, ...kpis } = panel.kpis
    start('/brecha', { path: '/srtm/brecha/corridas', body: [terminada] }, [{ path: `/srtm/brecha/${year}/panel`, body: { ...anterior, kpis } }])
    expect(await screen.findByRole('region', { name: 'Indicadores de la brecha' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Brecha por confianza' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sin levantar', { selector: 'p' })).not.toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Brecha por categoría' })).toBeInTheDocument()
  })

  it('says how the latest corrida was started', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [{ ...terminada, origen: 'CAMBIOS' }] })
    expect(await screen.findByRole('region', { name: 'Última corrida' })).toHaveTextContent('Automática (cambios del catastro)')
  })

  it('filters the predios by a categoría and a sector picked in the tables, and clears them', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [terminada] })
    await screen.findByRole('table', { name: 'Brecha por categoría' })
    await screen.findByRole('table', { name: 'Predios de la brecha' })

    await userEvent.click(within(screen.getByRole('table', { name: 'Brecha por categoría' })).getByRole('button', { name: 'Omisos' }))
    await waitFor(() => expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toContain('categoria=OMISO'))
    expect(within(screen.getByRole('table', { name: 'Brecha por categoría' })).getByRole('button', { name: 'Omisos' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(screen.getByRole('table', { name: 'Brecha por sector' })).getByRole('button', { name: 'Sector 01' }))
    await waitFor(() =>
      expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toBe(
        `/srtm/brecha/${year}/predios?categoria=OMISO&sector=01&page=0&size=20&corrida=c1`
      )
    )

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro de categoría Omisos' }))
    await waitFor(() =>
      expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toBe(`/srtm/brecha/${year}/predios?sector=01&page=0&size=20&corrida=c1`)
    )
  })

  it('calculates the brecha of the year, follows its progress every 2 s and shows the panel once it ends', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const lista: MockRoute = { path: '/srtm/brecha/corridas', body: [] }
    start('/brecha', lista, [{ method: 'POST', path: '/srtm/brecha/corridas', status: 202, body: corrida({}) }])
    await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)

    lista.body = [corrida({})]
    await userEvent.click(screen.getByRole('button', { name: 'Calcular brecha' }))
    expect(llamadas('POST', '/srtm/brecha/corridas')[0].body).toEqual({ anio: year })

    // measuring: no figure yet, and no second corrida while it runs
    const ultima = await screen.findByRole('region', { name: 'Última corrida' })
    expect(ultima).toHaveTextContent('Pendiente')
    expect(within(ultima).getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(ultima).toHaveTextContent('Cruzando el padrón con el catastro…')
    expect(screen.getByRole('button', { name: 'Calcular brecha' })).toBeDisabled()

    lista.body = [corrida({ estado: 'EN_CURSO', totalPredios: 10, procesados: 4 })]
    await act(() => vi.advanceTimersByTimeAsync(2000))
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Última corrida' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4'))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '10')
    expect(screen.getByRole('region', { name: 'Última corrida' })).toHaveTextContent('4/10 predios')
    expect(screen.getByRole('region', { name: 'Última corrida' })).toHaveTextContent('En curso')

    lista.body = [terminada]
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(await screen.findByRole('region', { name: 'Indicadores de la brecha' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Última corrida' })).toHaveTextContent('Terminada')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calcular brecha' })).toBeEnabled()

    // nothing runs: no more asking
    const pedidos = llamadas('GET', '/srtm/brecha/corridas').length
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(llamadas('GET', '/srtm/brecha/corridas')).toHaveLength(pedidos)
  })

  it('shows why a corrida failed, and the earlier TERMINADA one still below', async () => {
    start('/brecha', {
      path: '/srtm/brecha/corridas',
      body: [corrida({ id: 'c2', estado: 'FALLIDA', mensaje: `Faltan parámetros del impuesto predial: UIT ${year}` }), terminada]
    })
    const ultima = await screen.findByRole('region', { name: 'Última corrida' })
    expect(ultima).toHaveTextContent('Fallida')
    expect(ultima).toHaveTextContent(`Faltan parámetros del impuesto predial: UIT ${year}`)
    expect(await screen.findByRole('region', { name: 'Indicadores de la brecha' })).toBeInTheDocument()
    expect(llamadas('GET', `/srtm/brecha/${year}/panel`)[0].path).toBe(`/srtm/brecha/${year}/panel?corrida=c1`)
  })

  it('stops waiting on a corrida the backend reads abandoned (FALLIDA) and lets another start', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const lista: MockRoute = { path: '/srtm/brecha/corridas', body: [corrida({ id: 'c2', estado: 'EN_CURSO', totalPredios: 10, procesados: 4 }), terminada] }
    start('/brecha', lista)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Última corrida' })).toHaveTextContent('En curso'))
    expect(screen.getByRole('button', { name: 'Calcular brecha' })).toBeDisabled()

    // its instance died: the backend answers it FALLIDA once its latido is past the lease
    lista.body = [
      corrida({ id: 'c2', estado: 'FALLIDA', totalPredios: 10, procesados: 4, mensaje: 'Abandonada: sin latido desde 2026-10-19T15:00:00Z' }),
      terminada
    ]
    await act(() => vi.advanceTimersByTimeAsync(2000))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Última corrida' })).toHaveTextContent('Fallida'))
    expect(screen.getByRole('region', { name: 'Última corrida' })).toHaveTextContent('Abandonada: sin latido desde')
    expect(screen.getByRole('button', { name: 'Calcular brecha' })).toBeEnabled()

    const pedidos = llamadas('GET', '/srtm/brecha/corridas').length
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(llamadas('GET', '/srtm/brecha/corridas')).toHaveLength(pedidos)
  })

  it('starts the results of a new corrida afresh, without the filters of the previous one', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const lista: MockRoute = { path: '/srtm/brecha/corridas', body: [corrida({ id: 'c3', estado: 'EN_CURSO', totalPredios: 10, procesados: 4 }), terminada] }
    start('/brecha', lista)
    const categorias = await screen.findByRole('table', { name: 'Brecha por categoría' })
    await screen.findByRole('table', { name: 'Predios de la brecha' })
    await userEvent.click(within(categorias).getByRole('button', { name: 'Omisos' }))
    await waitFor(() =>
      expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toBe(`/srtm/brecha/${year}/predios?categoria=OMISO&page=0&size=20&corrida=c1`)
    )

    lista.body = [{ ...terminada, id: 'c3' }, terminada]
    await act(() => vi.advanceTimersByTimeAsync(2000))
    await waitFor(() => expect(llamadas('GET', `/srtm/brecha/${year}/predios`).at(-1)?.path).toBe(`/srtm/brecha/${year}/predios?page=0&size=20&corrida=c3`))
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Brecha por categoría' })).getByRole('button', { name: 'Omisos' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    )
    expect(screen.queryByRole('button', { name: 'Quitar el filtro de categoría Omisos' })).not.toBeInTheDocument()
  })

  it("says the backend's reason when it refuses a corrida (409)", async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [] }, [
      { method: 'POST', path: '/srtm/brecha/corridas', status: 409, body: { title: 'Conflict', detail: 'Catastro no configurado: falta la URL' } }
    ])
    await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)
    await userEvent.click(screen.getByRole('button', { name: 'Calcular brecha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Catastro no configurado: falta la URL')
  })

  it('leaves the button disabled with why without the permissions a corrida writes with', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [] }, [], { admin: false, objects: { brecha_corrida: ['READ'] } })
    await screen.findByText(`Aún no se ha calculado la brecha de ${year}`)
    expect(screen.getByRole('button', { name: 'Calcular brecha' })).toBeDisabled()
    expect(screen.getByText(/Sin permiso: pide creación y edición sobre las corridas de brecha/)).toBeInTheDocument()
  })

  it('asks for nothing without reading the corridas', async () => {
    start('/brecha', { path: '/srtm/brecha/corridas', body: [] }, [], { admin: false, objects: {} })
    expect(await screen.findByText(/Sin permiso para ver la brecha/)).toBeInTheDocument()
    expect(llamadas('GET', '/srtm/brecha/corridas')).toHaveLength(0)
  })
})
