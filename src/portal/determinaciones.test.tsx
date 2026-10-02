import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// la determinación masiva de los arbitrios de un año (wasichai/srtm-backend#64): se lanza con observación, se sigue
// su avance y se ven los predios que no se pudieron determinar; sin permiso no se lanza y se dice por qué; el 409 de
// otra en curso; una que no corre se elimina. no tiene archivo ni descarga

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const job = (valores: Record<string, unknown>) => ({
  id: 'd1',
  anio: year,
  estado: 'PENDIENTE',
  total: 0,
  procesados: 0,
  generadas: 0,
  errores: [],
  mensaje: null,
  observacion: 'Ordenanza del año',
  iniciado: `${year}-03-15T15:00:00Z`,
  terminado: null,
  ...valores
})

const base = (permisos: unknown = { admin: true, objects: {} }): MockRoute[] => [
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
  vi.restoreAllMocks()
})

function start(routes: MockRoute[], permisos?: unknown) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', '/arbitrios/determinaciones')
  fetch = mockFetch([...routes, ...base(permisos)])
  render(<PortalApp />)
}

describe('determinación masiva', () => {
  it('is reached from the menu', async () => {
    start([{ path: '/srtm/arbitrios/determinaciones', body: [] }])
    const menu = await screen.findByRole('navigation', { name: 'Secciones' })
    await userEvent.click(within(menu).getByRole('link', { name: 'Arbitrios' }))
    await userEvent.click(within(await screen.findByRole('navigation', { name: 'Arbitrios' })).getByRole('link', { name: 'Determinación masiva' }))
    expect(await screen.findByRole('heading', { name: 'Determinación masiva de arbitrios' })).toBeInTheDocument()
  })

  it('launches the year with its observación and lists the new job', async () => {
    // the backend's list, which has the new job once it is launched
    const lista: MockRoute = { path: '/srtm/arbitrios/determinaciones', body: [] }
    start([{ method: 'POST', path: '/srtm/arbitrios/determinaciones', status: 202, body: job({ id: 'd9' }) }, lista])
    expect(await screen.findByText('Aún no hay determinaciones masivas')).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Determinar' })
    expect(boton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Observación'), 'Ordenanza del año')
    lista.body = [job({ id: 'd9' })]
    await userEvent.click(boton)
    expect(await screen.findByRole('table', { name: 'Determinaciones masivas' })).toBeInTheDocument()
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ anio: year, observacion: 'Ordenanza del año' })
  })

  it('shows the progress, the cuotas written and the predios it could not determine, with why', async () => {
    start([
      {
        path: '/srtm/arbitrios/determinaciones',
        body: [
          job({
            estado: 'TERMINADA',
            total: 3,
            procesados: 3,
            generadas: 48,
            terminado: `${year}-03-15T15:10:00Z`,
            errores: [{ predio: '01-01-0009', mensaje: `ARBITRIO_ZONA S-09 ${year}` }]
          })
        ]
      }
    ])
    const fila = within(await screen.findByRole('table', { name: 'Determinaciones masivas' })).getAllByRole('row')[1]
    expect(within(fila).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    expect(fila).toHaveTextContent('48')
    expect(within(fila).queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
    await userEvent.click(within(fila).getByRole('button', { name: '1 predio sin determinar' }))
    expect(within(fila).getByText(`01-01-0009: ARBITRIO_ZONA S-09 ${year}`)).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('a running one cannot be deleted, and a second POST of the year is a 409', async () => {
    start([
      { method: 'POST', path: '/srtm/arbitrios/determinaciones', status: 409, body: { title: 'Conflict', detail: 'Ya hay una' } },
      { path: '/srtm/arbitrios/determinaciones', body: [job({ estado: 'EN_PROCESO', total: 10, procesados: 4 })] }
    ])
    const fila = within(await screen.findByRole('table', { name: 'Determinaciones masivas' })).getAllByRole('row')[1]
    expect(within(fila).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Observación'), 'Ordenanza del año')
    await userEvent.click(screen.getByRole('button', { name: 'Determinar' }))
    expect(await screen.findByText('Ya hay una determinación masiva del año en curso')).toBeInTheDocument()
  })

  it('without the permissions its lotes use, it cannot be launched, and says why', async () => {
    start([{ path: '/srtm/arbitrios/determinaciones', body: [] }], {
      admin: false,
      objects: { determinacion_arbitrio_masiva: ['READ', 'CREATE'], cuota_arbitrio: ['READ'] }
    })
    expect(await screen.findByText(/Sin permiso: pide creación y edición/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Determinar' })).toBeDisabled()
  })
})
