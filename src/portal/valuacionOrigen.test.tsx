import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// the valuación del padrón de origen (srtm-backend#132): what an external padrón (Ica) brought to the declaración,
// its predio and its niveles, read-only and only when it has a value. a declaración without one (404 from an older
// backend, or empty blocks) shows nothing of it

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const predio = { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', tipo_predio: 'PREDIO URBANO' }
const declaracion = { id: 'd1', contribuyente: 'c1', predio: 'p1', anio: year, secuencia_uso: '1', numero_declaracion: 39147, valor_autoavaluo: 56550.75 }
const nivel = (id: string, piso: number) => ({
  id,
  declaracion: 'd1',
  tipo_nivel: 'PISO',
  numero_piso: piso,
  anio_construccion: 2010,
  mes_construccion: null,
  material: 'LADRILLO',
  estado_conservacion: 'BUENO',
  area_construida: 120,
  estado: 'ACTIVO'
})
const totales = { declaraciones: 1, autoavaluo: 56550.75, valor_afecto: 56550.75 }

const ICA = {
  predio: { codigo_via: 'V0123', codigo_unidad_urbana: 'U045', codigo_hu_armonizacion: 'HU-01' },
  declaracion: { arancel: 35.5, valor_terreno: 7100, valor_construccion: 48250.75 },
  niveles: {
    n1: {
      clasificacion: 'CASA HABITACION Y DEPARTAMENTOS PARA VIVIENDA',
      valor_unitario: 402.08,
      incremento: 0,
      porcentaje_depreciacion: 12,
      valor_total: 48250.75
    }
  }
}
const VACIA = { predio: {}, declaracion: {}, niveles: {} }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/declaraciones/d1', body: { declaracion, predio, contribuyente: juan, actualizado: '2026-09-25T14:03:00Z' } },
  { path: '/srtm/declaraciones/d1/niveles', body: [nivel('n1', 1), nivel('n2', 2)] },
  { path: '/srtm/declaraciones/d1/obras', body: [] },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente: juan }] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const origen = (body: unknown): MockRoute => ({ path: '/srtm/declaraciones/d1/valuacion-origen', body })
const pedido = () => waitFor(() => expect(fetch!.calls.some((c) => c.path === '/srtm/declaraciones/d1/valuacion-origen')).toBe(true))
const datos = (bloque: HTMLElement) =>
  Object.fromEntries(
    within(bloque)
      .getAllByRole('term')
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent?.replace(/\s/g, ' ')])
  )

describe('valuación del padrón de origen', () => {
  it("shows the declaración's valuation in datos del predio, only the fields that have a value", async () => {
    start('/declaraciones/d1?tab=datos', [origen(ICA)])
    const bloque = await screen.findByRole('region', { name: 'Valuación del padrón de origen' })
    expect(datos(bloque)).toEqual({
      'Arancel (por m²)': 'S/ 35.50',
      'Valor del terreno': 'S/ 7,100.00',
      'Valor de la construcción': 'S/ 48,250.75'
    })
    expect(bloque).toHaveTextContent('No cambia el impuesto')
  })

  it("shows the predio's codes in the ubicación of the declaración", async () => {
    start('/declaraciones/d1?tab=ubicacion', [origen(ICA)])
    const bloque = await screen.findByRole('region', { name: 'Códigos del padrón de origen' })
    expect(datos(bloque)).toEqual({ 'Código de vía': 'V0123', 'Código de unidad urbana': 'U045', 'Código HU (armonización)': 'HU-01' })
  })

  it('adds the padrón de origen columns to the niveles, a dash where a nivel has none', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [origen(ICA)])
    const encabezado = await screen.findByRole('columnheader', { name: 'V. total (origen)' })
    const tabla = encabezado.closest('table')!
    for (const columna of ['Clasificación (origen)', 'V. unitario (origen)', 'Incremento por m² (origen)', '% depreciación (origen)']) {
      expect(within(tabla).getByRole('columnheader', { name: columna })).toBeInTheDocument()
    }
    const [, primero, segundo] = within(tabla).getAllByRole('row')
    // the clasificación with the portal's label, as the DJ's
    expect(primero).toHaveTextContent('CASA HABITACIÓN Y DEPARTAMENTOS PARA VIVIENDA')
    expect(primero).toHaveTextContent(/402\.08/)
    expect(primero).toHaveTextContent(/48,250\.75/)
    expect(
      within(segundo)
        .getAllByRole('cell')
        .slice(-5)
        .map((c) => c.textContent)
    ).toEqual(['—', '—', '—', '—', '—'])
    expect(screen.getByText(/columnas del padrón de origen/)).toBeInTheDocument()
  })

  // the niveles are asked for after the valuación (at the page's mount): once they are drawn, it has come
  it('shows nothing of it when the declaración has no padrón de origen', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [origen(VACIA)])
    expect(await screen.findAllByRole('cell', { name: 'LADRILLO' })).toHaveLength(2)
    await pedido()
    expect(screen.queryByRole('columnheader', { name: 'V. total (origen)' })).not.toBeInTheDocument()
    expect(screen.queryByText(/columnas del padrón de origen/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Datos del predio' }))
    expect(await screen.findByRole('tabpanel')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Valuación del padrón de origen' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Datos de la ubicación' }))
    expect(screen.queryByRole('region', { name: 'Códigos del padrón de origen' })).not.toBeInTheDocument()
  })

  it('shows nothing of it when the backend has no such endpoint (404)', async () => {
    start('/declaraciones/d1?tab=caracteristicas')
    expect(await screen.findAllByRole('cell', { name: 'LADRILLO' })).toHaveLength(2)
    await pedido()
    expect(screen.queryByRole('columnheader', { name: 'V. total (origen)' })).not.toBeInTheDocument()
    expect(screen.queryByText(/columnas del padrón de origen/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("shows the predio's codes in its ficha, from valuacion_origen", async () => {
    start('/predios/p1?tab=ubicacion', [
      { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales, valuacion_origen: { predio: { codigo_via_armonizacion: 'VA-02' } } } }
    ])
    const bloque = await screen.findByRole('region', { name: 'Códigos del padrón de origen' })
    expect(datos(bloque)).toEqual({ 'Código de vía (armonización)': 'VA-02' })
  })

  it('shows no codes in the ficha of a predio without them', async () => {
    start('/predios/p1?tab=ubicacion', [{ path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } }])
    expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Códigos del padrón de origen' })).not.toBeInTheDocument()
  })
})
