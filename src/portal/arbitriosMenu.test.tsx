import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// el grupo Arbitrios del menú (wasichai/srtm-backend#62): la consulta de las cuotas de un año, por servicio, y las
// tasas del año con su ordenanza, zonas, usos y vencimientos. cifras y ordenanza FICTICIAS

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

const servicios = [
  { id: 's1', codigo: 'LIMPIEZA', nombre: 'Limpieza pública', orden: 1, vigencia_desde: `${year}-01-01`, vigencia_hasta: null },
  { id: 's2', codigo: 'SERENAZGO', nombre: 'Serenazgo', orden: 2, vigencia_desde: `${year}-01-01`, vigencia_hasta: null }
]

const fila = (tipo: string, clave: string, valores: Record<string, unknown>) => ({
  id: `${tipo}-${clave}`,
  tipo,
  clave,
  vigencia_desde: `${year}-01-01`,
  vigencia_hasta: null,
  valor_numerico: null,
  texto: null,
  norma: 'Ordenanza ficticia',
  fuente: null,
  transcribio: 'A',
  verifico: 'B',
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

describe('consulta de cuotas', () => {
  it('lists the year cuotas with their servicio, month, date and links, and filters by servicio', async () => {
    const pagina = {
      content: [
        {
          id: 'q1',
          predio: 'p1',
          contribuyente: 'c1',
          servicio: 's2',
          anio: year,
          periodo: 3,
          monto: 4.25,
          parametro_aplicado: 'TASA_ARBITRIO:SERENAZGO:Z1:CASA',
          fecha_calculo: `${year}-03-15`,
          observacion: 'Ordenanza'
        }
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1
    }
    start('/arbitrios', [
      { path: '/srtm/arbitrios/servicios', body: servicios },
      { path: '/srtm/arbitrios', body: pagina }
    ])
    const tabla = await screen.findByRole('table', { name: `Cuotas de arbitrios ${year}` })
    const [, cuota] = within(tabla).getAllByRole('row')
    expect(cuota).toHaveTextContent('MARZO')
    expect(cuota).toHaveTextContent('Serenazgo')
    expect(within(cuota).getByRole('link', { name: 'Ver predio' })).toHaveAttribute('href', '/predios/p1?tab=arbitrios')
    expect(within(cuota).getByRole('link', { name: 'Ver contribuyente' })).toHaveAttribute('href', '/contribuyentes/c1?tab=arbitrios')

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Servicio' }), 's1')
    const pedido = fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/arbitrios?')).at(-1)!
    expect(new URLSearchParams(pedido.path.split('?')[1]).get('servicio')).toBe('s1')
  })
})

describe('tasas del año', () => {
  it('shows the ordinance, its tasas split by servicio, zona and uso, and its due dates', async () => {
    start('/arbitrios/tasas', [
      {
        path: '/srtm/arbitrios/parametros',
        body: {
          anio: year,
          ordenanza: {
            id: 'o1',
            anio: year,
            numero: '000-MD (ficticia)',
            fecha_publicacion: null,
            acuerdo_ratificacion: 'AC 000 (ficticio)',
            fecha_ratificacion: `${year - 1}-12-28`,
            municipalidad_ratificante: 'PROVINCIAL'
          },
          servicios,
          parametros: [
            fila('TASA_ARBITRIO', 'LIMPIEZA:Z1:CASA', { valor_numerico: 8.5 }),
            fila('ARBITRIO_ZONA', 'S-01', { texto: 'Z1' }),
            fila('ARBITRIO_VENCIMIENTO', '1', { texto: `${year}-01-31` })
          ],
          faltan: []
        }
      }
    ])
    expect(await screen.findByText('000-MD (ficticia)')).toBeInTheDocument()
    const [, tasa] = within(screen.getByRole('table', { name: 'Tasas mensuales' })).getAllByRole('row')
    expect(
      within(tasa)
        .getAllByRole('cell')
        .map((c) => c.textContent)
        .slice(0, 3)
    ).toEqual(['LIMPIEZA', 'Z1', 'CASA'])
    expect(tasa.textContent).toMatch(/8[.,]50/)
    expect(within(screen.getByRole('table', { name: 'Vencimientos' })).getByText('ENERO')).toBeInTheDocument()
    // a tipo without rows says so
    expect(screen.getByText('Uso de arbitrio de cada uso del predio').parentElement).toHaveTextContent('Ninguna en el año.')
  })

  it('names what the year lacks', async () => {
    start('/arbitrios/tasas', [
      { path: '/srtm/arbitrios/parametros', body: { anio: year, ordenanza: null, servicios: [], parametros: [], faltan: [`Ordenanza de arbitrios ${year}`] } }
    ])
    expect(await screen.findByText(`Al año ${year} le falta:`)).toBeInTheDocument()
    expect(screen.getByText(`No hay ordenanza de arbitrios de ${year}.`)).toBeInTheDocument()
  })
})
