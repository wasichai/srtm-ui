import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { DesgloseCuota, FilaServicio, MatrizArbitrios } from './types'

// los arbitrios de un año en las fichas de predio y de contribuyente (wasichai/srtm-backend#62): servicio por mes, el
// titular de cada mes y los totales, tal como los determinó el backend. los totales son los suyos, nunca una suma de la
// pantalla; toda cifra lleva su fecha; un mes sin cuota lo dice y nunca muestra 0. cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const base: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const predioFicha = {
  predio: { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', tipo_predio: 'PREDIO URBANO' },
  titulares: 1,
  totales: { autoavaluo: 0, valor_afecto: 0 }
}

const fila = (id: string, nombre: string, monto: number | null, meses: number, total: number): FilaServicio => ({
  servicio: { id, codigo: id.toUpperCase(), nombre, orden: 1, vigencia_desde: `${year}-01-01`, vigencia_hasta: null },
  meses: Array.from({ length: 12 }, (_, i) =>
    monto !== null && i < meses ? { id: `${id}-${i}`, monto, contribuyente: 'c1', fecha_calculo: `${year}-03-15`, parametro_aplicado: 'TASA_ARBITRIO:X' } : null
  ),
  total
})

const matriz = (valores: Partial<MatrizArbitrios>): MatrizArbitrios => ({
  anio: year,
  predio: { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123' },
  filas: [fila('limpieza', 'Limpieza pública', 8.5, 12, 102), fila('serenazgo', 'Serenazgo', 4.25, 12, 51)],
  titulares: Array.from({ length: 12 }, (_, i) => ({
    periodo: i + 1,
    titular: i < 5 ? { id: 'c1', codigo: '000001', nombre: 'ANA' } : { id: 'c2', codigo: '000002', nombre: 'BETO' }
  })),
  totales_por_mes: Array.from({ length: 12 }, () => 12.75),
  // the backend's: not the sum of the rows on purpose, so a total summed on screen would show
  total: 999.99,
  fecha_calculo: `${year}-03-15`,
  pendientes: 0,
  faltan: [],
  ...valores
})

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  vi.restoreAllMocks()
})

function start(path: string, routes: MockRoute[]) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...routes, ...base])
  render(<PortalApp />)
}

const tabla = async () => screen.findByRole('table', { name: `Arbitrios ${year} del predio 01-01-0001` })

describe('arbitrios del predio', () => {
  it('shows servicio by month with the backend totals, the date and each month titular', async () => {
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: matriz({}) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    const [encabezado, limpieza, , total] = within(t).getAllByRole('row')
    expect(
      within(encabezado)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(expect.arrayContaining(['Servicio', 'ENE', 'DIC', 'Total']))
    expect(limpieza).toHaveTextContent('Limpieza pública')
    expect(within(limpieza).getAllByRole('cell')).toHaveLength(14)
    // the year's total is the backend's, never the sum of the rows
    expect(within(total).getAllByRole('cell').at(-1)?.textContent).toMatch(/999[.,]99/)
    expect(screen.getByText(/Determinados al/)).toBeInTheDocument()
    const titulares = screen.getByRole('list', { name: 'Titular de cada mes' })
    expect(
      within(titulares)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['ENE–MAY: 000001 · ANA', 'JUN–DIC: 000002 · BETO'])
  })

  it('says why a month has no cuota, and what is still to determine, instead of a 0', async () => {
    const sinDeterminar = matriz({
      filas: [fila('limpieza', 'Limpieza pública', null, 0, 0)],
      totales_por_mes: Array.from({ length: 12 }, () => 0),
      total: 0,
      fecha_calculo: null,
      pendientes: 12
    })
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: sinDeterminar },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    expect(within(t).queryByText(/0[.,]00/)).not.toBeInTheDocument()
    expect(within(t).getAllByTitle('Sin cuota determinada').length).toBeGreaterThan(12)
    expect(screen.getByText(`Aún no se determinan los arbitrios de ${year}: 12 cuotas por determinar.`)).toBeInTheDocument()
    expect(screen.queryByText(/Determinados al/)).not.toBeInTheDocument()
  })

  it('names what keeps the year from being determined', async () => {
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: matriz({ faltan: [`ARBITRIO_ZONA S-09 ${year}`] }) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    await tabla()
    expect(screen.getByText('No se pueden determinar:').parentElement).toHaveTextContent(`ARBITRIO_ZONA S-09 ${year}`)
  })

  // by its enlace, where it gets fixed: predio and declaracion only say whose it is. a row of the ordinance names the
  // predio too, and nothing in the predio fixes it
  it('links a falta to the declaración, or to the predio, that fixes it; the rest, as plain text', async () => {
    const faltanDetalle = [
      { mensaje: 'Frontis del predio 01-01-0001', predio: 'p1', declaracion: 'd1', enlace: 'DECLARACION' as const },
      { mensaje: 'Ubicación respecto del área verde del predio 01-01-0001', predio: 'p1', declaracion: null, enlace: 'PREDIO' as const },
      { mensaje: `TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`, predio: 'p1', declaracion: null, enlace: null },
      { mensaje: `Factor de habitantes negativo en 01-01-0001`, predio: 'p1', declaracion: 'd1', enlace: null },
      { mensaje: `ARBITRIO_USO 010101 ${year}`, predio: 'p1', declaracion: 'd1' },
      { mensaje: `Servicios de arbitrio vigentes en ${year}` }
    ]
    start('/predios/p1?tab=arbitrios', [
      {
        path: '/srtm/predios/p1/arbitrios',
        body: matriz({ faltan: faltanDetalle.map((f) => f.mensaje), faltan_detalle: faltanDetalle })
      },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    await tabla()
    const alerta = screen.getByText('No se pueden determinar:').parentElement!
    expect(within(alerta).getByRole('link', { name: 'Frontis del predio 01-01-0001' })).toHaveAttribute('href', '/declaraciones/d1?tab=caracteristicas')
    expect(within(alerta).getByRole('link', { name: 'Ubicación respecto del área verde del predio 01-01-0001' })).toHaveAttribute(
      'href',
      '/predios/p1?tab=ubicacion'
    )
    expect(within(alerta).getAllByRole('link')).toHaveLength(2)
    expect(alerta).toHaveTextContent(`TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`)
    expect(alerta).toHaveTextContent('Factor de habitantes negativo en 01-01-0001')
    expect(alerta).toHaveTextContent(`ARBITRIO_USO 010101 ${year}`)
    expect(alerta).toHaveTextContent(`Servicios de arbitrio vigentes en ${year}`)
  })

  it('shows the faltan as plain text, like before, when the backend sends no detalle', async () => {
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: matriz({ faltan: [`ARBITRIO_ZONA S-09 ${year}`] }) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    await tabla()
    const alerta = screen.getByText('No se pueden determinar:').parentElement!
    expect(within(alerta).queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('desglose de la cuota, por secuencia de uso', () => {
  const desglose = (secuencia: string, formula: string): DesgloseCuota => ({
    id: `d-${secuencia}`,
    secuencia_uso: secuencia,
    monto: null,
    base: 'AREA_CONSTRUIDA_M2',
    cantidad_base: null,
    tasa_unitaria: null,
    habitantes: null,
    promedio_habitantes: null,
    variacion_habitante: null,
    habitantes_presuntos: null,
    zona: null,
    uso_arbitrio: null,
    influencia: null,
    afluencia: null,
    formula
  })

  // the first month of limpieza, with its desglose
  const conEnero = (items: DesgloseCuota[]) =>
    matriz({
      filas: [
        {
          ...fila('limpieza', 'Limpieza pública', 8.5, 12, 102),
          meses: fila('limpieza', 'Limpieza pública', 8.5, 12, 102).meses.map((c, i) => (i === 0 && c ? { ...c, desglose: items } : c))
        }
      ]
    })

  it('shows the formula of each secuencia on tap, over a cell with two of them, each with its uso', async () => {
    start('/predios/p1?tab=arbitrios', [
      {
        path: '/srtm/predios/p1/arbitrios',
        body: conEnero([desglose('01', '0.0514 S/ por m² × 100.00 m² = 5.14'), desglose('02', '0.0514 S/ por m² × 65.00 m² = 3.34')])
      },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    expect(within(t).queryByText(/0\.0514 S\/ por m² × 100\.00 m²/)).not.toBeInTheDocument()
    await userEvent.click(within(t).getByRole('button', { name: /8[.,]50/ }))
    expect(screen.getByText('Uso 01: 0.0514 S/ por m² × 100.00 m² = 5.14')).toBeInTheDocument()
    expect(screen.getByText('Uso 02: 0.0514 S/ por m² × 65.00 m² = 3.34')).toBeInTheDocument()
  })

  it('shows the formula alone when the cell has one secuencia', async () => {
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: conEnero([desglose('01', '0.0514 S/ por m² × 100.00 m² = 5.14')]) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    await userEvent.click(within(t).getByRole('button', { name: /8[.,]50/ }))
    expect(screen.getByText('0.0514 S/ por m² × 100.00 m² = 5.14')).toBeInTheDocument()
  })

  // the real backend always sends desglose: for a cuota written before it, one item per secuencia with base null and
  // just its monto as formula
  it('shows only the monto, like before, on a cuota from before the desglose that comes with one', async () => {
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: conEnero([{ ...desglose('01', 'S/ 8.50'), base: null }]) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    const [, limpieza] = within(t).getAllByRole('row')
    expect(within(limpieza).queryAllByRole('button')).toHaveLength(0)
    expect(within(limpieza).getAllByTitle('TASA_ARBITRIO:X')).toHaveLength(12)
  })

  it('shows only the monto, like before, on a cuota from before the desglose', async () => {
    start('/predios/p1?tab=arbitrios', [
      { path: '/srtm/predios/p1/arbitrios', body: matriz({}) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    const [, limpieza] = within(t).getAllByRole('row')
    expect(within(limpieza).queryAllByRole('button')).toHaveLength(0)
    expect(within(limpieza).getAllByTitle('TASA_ARBITRIO:X').length).toBeGreaterThan(0)
  })
})

describe('consulta de cuotas de arbitrios, igual de accesible', () => {
  it('shows the parámetro aplicado on tap, not just on hover (title does not work on touch)', async () => {
    start('/arbitrios', [
      {
        path: '/srtm/arbitrios/servicios',
        body: [{ id: 'limpieza', codigo: 'LIMPIEZA', nombre: 'Limpieza pública', orden: 1, vigencia_desde: `${year}-01-01`, vigencia_hasta: null }]
      },
      {
        path: '/srtm/arbitrios',
        body: {
          content: [
            {
              id: 'q1',
              predio: 'p1',
              contribuyente: 'c1',
              servicio: 'limpieza',
              anio: year,
              periodo: 1,
              monto: 8.5,
              parametro_aplicado: 'TASA_ARBITRIO:X',
              fecha_calculo: `${year}-03-15`,
              observacion: ''
            }
          ],
          page: 0,
          size: 25,
          totalElements: 1,
          totalPages: 1
        }
      }
    ])
    const t = await screen.findByRole('table', { name: `Cuotas de arbitrios ${year}` })
    expect(within(t).queryByText('TASA_ARBITRIO:X')).not.toBeInTheDocument()
    await userEvent.click(within(t).getByRole('button', { name: /8[.,]50/ }))
    expect(screen.getByText('TASA_ARBITRIO:X')).toBeInTheDocument()
  })
})

describe('arbitrios en los dos temas', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme
  })

  it.each(['light', 'portal-tributario'])('shows the same table and the same backend total with %s', async (theme) => {
    localStorage.setItem('srtm.theme', theme)
    start('/predios/p1?tab=arbitrios', [
      { path: '/auth/me/preferences', body: { theme, locale: null } },
      { path: '/srtm/predios/p1/arbitrios', body: matriz({}) },
      { path: '/srtm/predios/p1', body: predioFicha }
    ])
    const t = await tabla()
    expect(within(t).getAllByRole('row').at(-1)?.textContent).toMatch(/999[.,]99/)
    expect(screen.getByRole('list', { name: 'Titular de cada mes' })).toBeInTheDocument()
  })
})

describe('arbitrios del contribuyente', () => {
  it('lists each predio with its own cuotas and the backend total of the year', async () => {
    start('/contribuyentes/c1?tab=arbitrios', [
      {
        path: '/srtm/contribuyentes/c1/arbitrios',
        body: {
          anio: year,
          contribuyente: { id: 'c1', codigo: '000001', nombre: 'ANA' },
          predios: [matriz({})],
          total: 1234.56,
          fecha_calculo: `${year}-03-15`
        }
      },
      {
        path: '/srtm/contribuyentes/c1',
        body: {
          contribuyente: { id: 'c1', codigo: '000001', nombre_completo: 'ANA', numero_documento: '12345678', estado: 'ACTIVO' },
          predios: 1,
          totales: { autoavaluo: 0, valor_afecto: 0 }
        }
      }
    ])
    expect(await tabla()).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '01-01-0001' })).toHaveAttribute('href', '/predios/p1?tab=arbitrios')
    expect(screen.getByTestId('total-arbitrios')).toHaveTextContent(/1[.,]?234[.,]56/)
    expect(screen.getByTestId('total-arbitrios')).toHaveTextContent('determinados al')
    // a contribuyente's view does not list the titulares of the predio
    expect(screen.queryByRole('list', { name: 'Titular de cada mes' })).not.toBeInTheDocument()
  })
})
