import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { LotesMapProps } from './components/LotesMap'

// the srtm's ubicación asks for neither sector nor manzana catastral (page 14): the backend codes the predio without
// them. jsdom has no webgl: the map is a double
vi.mock('./components/LotesMap', () => ({
  LotesMap: (props: LotesMapProps) => <div data-testid="lotes-map" aria-label={props.label} />
}))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const contribuyente = { id: 'c1', codigo: '000012', nombre_completo: 'QUISPE MAMANI JUAN', tipo_persona: 'NATURAL' }
const predio = {
  id: 'p9',
  codigo: 'P-000001',
  sector_catastral: null,
  manzana_catastral: null,
  tipo_predio: 'PREDIO URBANO',
  direccion: 'AVENIDA MARGINAL, UNION PERENE, JUNIN-CHANCHAMAYO-PERENE',
  numero_registro: 1
}
const dj = {
  declaracion: { id: 'd9', contribuyente: 'c1', predio: 'p9', anio: year, numero_declaracion: 39150, tipo_adquisicion: 'COMPRA' },
  predio,
  contribuyente,
  actualizado: null
}

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      predio: {
        tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
        region: ['COSTA', 'SIERRA', 'SELVA'],
        tipo_via: ['AVENIDA', 'CALLE'],
        tipo_zona: ['CENTRO POBLADO']
      },
      declaracion_predial: {
        medio_presentacion: ['FISICO'],
        medio_determinacion: ['DECLARACION JURADA'],
        motivo: ['INSCRIPCION'],
        tipo_adquisicion: ['COMPRA'],
        condicion_propiedad: ['PROPIETARIO UNICO']
      }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 0, totales: { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 } } },
  { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj },
  { path: '/srtm/declaraciones/d9', body: dj },
  { path: /^\/srtm\/declaraciones\/d9\//, body: [] }
]

let fetch: FetchMock | null = null
afterEach(() => fetch?.restore())

function start(path: string) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

describe('ubicación without sector or manzana catastral', () => {
  it('presents the declaracion jurada on a new predio, which the backend codes', async () => {
    start('/contribuyentes/c1/declaraciones/nueva')
    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
    // shown, but not asked for: no asterisk
    expect(screen.getByLabelText('Sector')).toHaveValue('')
    expect(screen.getByLabelText('Manzana catastral')).toHaveValue('')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de vía/), 'AVENIDA')
    await userEvent.type(screen.getByLabelText(/Descripción de la vía/), 'MARGINAL')
    await userEvent.type(screen.getByLabelText(/Descripción de la zona/), 'UNION PERENE')
    await userEvent.type(screen.getByLabelText(/Código CPU/), '54102166-0001-2')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await waitFor(() => {
      const call = fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/declaraciones-juradas')
      expect(call).toBeDefined()
      return call!
    })
    expect(post.body).toMatchObject({
      declaracion: { tipo_adquisicion: 'COMPRA' },
      predio: { sector_catastral: null, manzana_catastral: null, via: 'MARGINAL', habilitacion_urbana: 'UNION PERENE', codigo: null }
    })
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })).toBeInTheDocument()
  })
})
