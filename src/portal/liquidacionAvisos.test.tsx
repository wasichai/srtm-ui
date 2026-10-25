import { render, screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// the liquidación of a contribuyente says which of its DJ are por revisar (srtm-backend#242): they are liquidated all
// the same, on the autoavalúo stored, so the ficha warns of each and links to it. cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const juan = { id: 'c1', codigo: '000123', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const totales = { declaraciones: 2, autoavaluo: 20000, valor_afecto: 20000 }

const liquidacion = (avisos: object[]) => ({
  anio: year,
  uit: 5500,
  base: 20000,
  tramos: [],
  impuestoCalculado: 40,
  minimo: 33,
  minimoAplicado: false,
  impuestoAnual: 40,
  cuotas: [],
  faltan: [],
  avisos
})

const LIQUIDACION = new RegExp(`^/srtm/contribuyentes/c1/liquidacion\\?anio=${year}$`)

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente: juan, anio: year, predios: 2, totales } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

function start(extra: MockRoute[]) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', '/contribuyentes/c1')
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

describe('los avisos de la liquidación', () => {
  it('lists each DJ por revisar of the year, with its predio and why, linking to it', async () => {
    start([
      {
        path: LIQUIDACION,
        body: liquidacion([
          { declaracion: 'd1', predio: 'p1', predioCodigo: '01-01-0006', motivo: 'TABLA_DE_DEPRECIACION:' },
          { declaracion: 'd2', predio: 'p2', predioCodigo: null, motivo: 'El autoavalúo de la declaración está por revisar' }
        ])
      }
    ])
    const aviso = await screen.findByRole('region', { name: 'DJ por revisar en la liquidación' })
    expect(aviso).toHaveTextContent(`La liquidación de ${year} usa el autoavalúo guardado de 2 DJ por revisar`)
    const items = within(aviso).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Ningún piso tiene tabla de depreciación')
    expect(within(items[0]).getByRole('link', { name: 'Predio 01-01-0006' })).toHaveAttribute('href', '/declaraciones/d1')
    expect(items[1]).toHaveTextContent('El autoavalúo de la declaración está por revisar')
    expect(within(items[1]).getByRole('link', { name: 'Declaración' })).toHaveAttribute('href', '/declaraciones/d2')
  })

  it('says it in the singular for one DJ', async () => {
    start([{ path: LIQUIDACION, body: liquidacion([{ declaracion: 'd1', predio: 'p1', predioCodigo: '01-01-0006', motivo: 'AREA_TERRENO_FALTANTE' }]) }])
    const aviso = await screen.findByRole('region', { name: 'DJ por revisar en la liquidación' })
    expect(aviso).toHaveTextContent(`La liquidación de ${year} usa el autoavalúo guardado de 1 DJ por revisar. Recalcúlala desde su declaración.`)
    expect(aviso).toHaveTextContent('Predio 01-01-0006: Falta el área del terreno')
  })

  it.each([
    ['no DJ is por revisar', { body: liquidacion([]) }],
    ['a backend before srtm-backend#242 answers no avisos', { body: { ...liquidacion([]), avisos: undefined } }],
    ['the liquidación cannot be read', { status: 500, body: { title: 'Internal Server Error' } }]
  ])('says nothing when %s', async (_, respuesta) => {
    start([{ path: LIQUIDACION, ...respuesta }])
    expect(await screen.findByText('QUISPE MAMANI JUAN')).toBeInTheDocument()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/contribuyentes/c1/liquidacion'))).toBe(true))
    // the answer read and rendered: the query settles a tick after the call
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region', { name: 'DJ por revisar en la liquidación' })).not.toBeInTheDocument()
  })
})
