import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { EstadoCaja, OrdenEnCaja } from './types'

// la pestaña «Caja» de la ficha del contribuyente y el botón «Enviar a caja» (wasichai/srtm-ui#123). cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const base = (permisos: unknown = { admin: true, objects: {} }): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } },
  {
    path: '/srtm/contribuyentes/c1',
    body: {
      contribuyente: { id: 'c1', codigo: '000001', nombre_completo: 'ANA', numero_documento: '12345678', estado: 'ACTIVO' },
      predios: 1,
      totales: { autoavaluo: 0, valor_afecto: 0 }
    }
  }
]

const orden = (valores: Partial<OrdenEnCaja>): OrdenEnCaja => ({
  id: 'o1',
  referencia: 'PRE-0001',
  tipo: 'PREDIAL',
  ranura: '1',
  importe: 120.5,
  concepto: 'Impuesto predial 1T',
  estado: 'ENVIADA',
  pagada: false,
  ultimo_error: null,
  enviada_en: `${year}-02-01T10:00:00Z`,
  retirada_en: null,
  ...valores
})

const estado = (valores: Partial<EstadoCaja> = {}): EstadoCaja => ({
  ordenes: [
    orden({}),
    orden({ id: 'o2', referencia: 'ARB-0002', tipo: 'ARBITRIO', concepto: 'Limpieza pública enero', importe: 8.5, estado: 'PAGADA_EN_CAJA', pagada: true })
  ],
  saldo_a_favor: 0,
  ...valores
})

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.restoreAllMocks()
})

function start(routes: MockRoute[], permisos?: unknown) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', '/contribuyentes/c1?tab=caja')
  fetch = mockFetch([...routes, ...base(permisos)])
  render(<PortalApp />)
}

const enCaja = (permisos?: unknown) => ({ admin: false, objects: { orden_caja: ['READ', ...(permisos ? ['CREATE'] : [])] } })

const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/contribuyentes/c1/caja')).length

// mockFetch answers no headers of its own: the POST of /caja carries Srtm-Caja too
function conEncabezado(valor: string) {
  const anterior = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const respuesta = await anterior(input, init)
    if ((init?.method ?? 'GET').toUpperCase() !== 'POST') return respuesta
    const headers = new Headers(respuesta.headers)
    headers.set('Srtm-Caja', valor)
    return new Response(await respuesta.text(), { status: respuesta.status, headers })
  }
}

describe('la pestaña Caja', () => {
  it('lists the ordenes with referencia, concepto, importe, estado and the paid badge', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', body: estado({ ordenes: [orden({ ultimo_error: 'Caja rechazó la orden' }), estado().ordenes[1]] }) }])
    const tabla = await screen.findByRole('table')
    expect(within(tabla).getByText('PRE-0001')).toBeInTheDocument()
    expect(within(tabla).getByText('Impuesto predial 1T')).toBeInTheDocument()
    expect(within(tabla).getByText(/120[.,]50/)).toBeInTheDocument()
    expect(within(tabla).getByText('En caja')).toBeInTheDocument()
    expect(within(tabla).getByText('Pagada en caja')).toBeInTheDocument()
    expect(within(tabla).getAllByText('Pagada')).toHaveLength(1)
    expect(within(tabla).getByText('Caja rechazó la orden')).toBeInTheDocument()
    expect(fetch!.calls.find((c) => c.method === 'GET' && c.path.startsWith('/srtm/contribuyentes/c1/caja'))!.url).toContain(`anio=${year}`)
  })

  it('shows an unknown estado raw', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', body: estado({ ordenes: [orden({ estado: 'RARA' })] }) }])
    expect(await screen.findByText('RARA')).toBeInTheDocument()
  })

  it('shows the saldo a favor when there is one, and hides it at 0', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', body: estado({ saldo_a_favor: 45.5 }) }])
    expect(await screen.findByText(/Saldo a favor: S\/\s?45[.,]50/)).toBeInTheDocument()
  })

  it('no saldo a favor at 0', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', body: estado() }])
    await screen.findByRole('table')
    expect(screen.queryByText(/Saldo a favor/)).not.toBeInTheDocument()
  })

  it('says there is no caja (409), with neither button nor table', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', status: 409, body: { title: 'Conflict', detail: 'SIN_CAJA_CONFIGURADA' } }])
    expect(await screen.findByText('La municipalidad no tiene caja configurada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar a caja' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says there are no ordenes', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', body: estado({ ordenes: [] }) }])
    expect(await screen.findByText(`No hay órdenes en caja para ${year}`)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows sin_documento inline after sending', async () => {
    start([
      {
        method: 'POST',
        path: '/srtm/contribuyentes/c1/caja',
        body: { encoladas: 0, enviadas: 0, sustituidas: 0, retiradas: 0, pagadas_en_caja: 0, conflictos: 0, pendientes: 0, sin_documento: 2, error: null }
      },
      { path: '/srtm/contribuyentes/c1/caja', body: estado() }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar a caja' }))
    expect(await screen.findByText('El contribuyente no tiene documento: no se envía a caja')).toBeInTheDocument()
  })
})

describe('Enviar a caja', () => {
  it('without CREATE on orden_caja there is no button', async () => {
    start([{ path: '/srtm/contribuyentes/c1/caja', body: estado() }], enCaja())
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Enviar a caja' })).not.toBeInTheDocument()
  })

  it('posts the year, reads again and the aviso says it, once even if the response carries the header', async () => {
    const resumen = { encoladas: 0, enviadas: 1, sustituidas: 0, retiradas: 0, pagadas_en_caja: 0, conflictos: 0, pendientes: 0, sin_documento: 0, error: null }
    start(
      [
        { method: 'POST', path: '/srtm/contribuyentes/c1/caja', body: resumen },
        { path: '/srtm/contribuyentes/c1/caja', body: estado() }
      ],
      enCaja(true)
    )
    conEncabezado('{"encoladas":0,"enviadas":1,"sustituidas":0,"retiradas":0,"pagadas_en_caja":0,"conflictos":0,"pendientes":0,"error":null}')
    const boton = await screen.findByRole('button', { name: 'Enviar a caja' })
    const antes = lecturas()
    await userEvent.click(boton)
    expect(await screen.findByText('Caja: 1 orden enviada')).toBeInTheDocument()
    expect(screen.getAllByText('Caja: 1 orden enviada')).toHaveLength(1)
    const post = fetch!.calls.find((c) => c.method === 'POST')!
    expect(post.url).toContain(`anio=${year}`)
    await vi.waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
  })

  it('shows the problem of a failed send (503) in the tab', async () => {
    start(
      [
        { method: 'POST', path: '/srtm/contribuyentes/c1/caja', status: 503, body: { title: 'Service Unavailable', detail: 'Caja no responde' } },
        { path: '/srtm/contribuyentes/c1/caja', body: estado() }
      ],
      enCaja(true)
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar a caja' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Caja no responde')
  })
})
