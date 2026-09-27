import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { formatMoney } from './components/format'

// the year's footer: a predio held in condominio counts once, not once per condómino (srtm-backend#5)

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const rosa = { id: 'c2', tipo_documento: 'DNI', numero_documento: '43434352', nombre_completo: 'NEIRA CAMPOS ROSA' }
const compartido = { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', condicion: 'URBANO' }
const propio = { id: 'p2', codigo: '01-01-0002', direccion: 'JR. LIMA 125', condicion: 'URBANO' }

// p1 is worth 10000.50: 6000.25 is juan's, 4000.25 rosa's. p2 is juan's alone
const declaracion = (id: string, contribuyente: string, predio: string, valores: Record<string, unknown>) => ({
  id,
  contribuyente,
  predio,
  anio: year,
  secuencia_uso: '1',
  uso: 'RESIDENCIAL - CASA HABITACION',
  ...valores
})
const deJuan = declaracion('d1', 'c1', 'p1', {
  condicion_propiedad: 'CONDOMINO',
  porcentaje_condominio: 60,
  valor_autoavaluo: 10000.5,
  valor_condominio: 6000.25,
  valor_afecto: 6000.25
})
const deRosa = declaracion('d2', 'c2', 'p1', {
  condicion_propiedad: 'CONDOMINO',
  porcentaje_condominio: 40,
  valor_autoavaluo: 10000.5,
  valor_condominio: 4000.25,
  valor_afecto: 4000.25
})
const soloDeJuan = declaracion('d3', 'c1', 'p2', {
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  valor_autoavaluo: 5000.5,
  valor_condominio: null,
  valor_afecto: 5000.5
})

// the fichas carry the backend's totals
const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  {
    path: '/srtm/contribuyentes/c1',
    body: { contribuyente: juan, anio: year, predios: 2, totales: { declaraciones: 2, autoavaluo: 11000.75, valor_afecto: 11000.75 } }
  },
  {
    path: '/srtm/contribuyentes/c1/declaraciones',
    body: [
      { declaracion: deJuan, predio: compartido, contribuyente: null },
      { declaracion: soloDeJuan, predio: propio, contribuyente: null }
    ]
  },
  {
    path: '/srtm/predios/p1',
    body: { predio: compartido, anio: year, titulares: 2, totales: { declaraciones: 2, autoavaluo: 10000.5, valor_afecto: 10000.5 } }
  },
  {
    path: '/srtm/predios/p1/declaraciones',
    body: [
      { declaracion: deJuan, predio: null, contribuyente: juan },
      { declaracion: deRosa, predio: null, contribuyente: rosa }
    ]
  },
  { path: '/srtm/declaraciones/d1', body: { declaracion: deJuan, predio: compartido, contribuyente: juan, actualizado: '2026-09-25T14:03:00Z' } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

function start(path: string) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

// the text a cell shows: formatMoney's non-breaking space reads as a space
const soles = (value: number) => formatMoney(value).replace(/\s/g, ' ')
const footer = async () => (await screen.findByText(`Total ${year}`)).closest('tr')!

describe('the year footer of a ficha', () => {
  it("counts a predio's autoavalúo once, however many condóminos it has", async () => {
    start('/predios/p1?tab=titulares')
    const total = await footer()
    await waitFor(() => expect(total).toHaveTextContent(`Total ${year}${soles(10000.5)}${soles(10000.5)}`))
    expect(total).not.toHaveTextContent(soles(20001))
  })

  it("counts a contribuyente's part of a predio in condominio, and a sole owner's whole autoavalúo", async () => {
    start('/contribuyentes/c1?tab=predios')
    const total = await footer()
    await waitFor(() => expect(total).toHaveTextContent(`Total ${year}${soles(11000.75)}${soles(11000.75)}`))
    expect(total).not.toHaveTextContent(soles(15001))
  })

  it("shows the predio's totals among a declaration's condóminos too", async () => {
    start('/declaraciones/d1?tab=condominos')
    const total = await footer()
    await waitFor(() => expect(total).toHaveTextContent(`Total ${year}${soles(10000.5)}${soles(10000.5)}`))
    expect(fetch!.calls.some((c) => c.path === `/srtm/predios/p1?anio=${year}`)).toBe(true)
  })
})
