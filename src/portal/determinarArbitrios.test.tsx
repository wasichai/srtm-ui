import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { MatrizArbitrios } from './types'

// determinar los arbitrios de un año desde la ficha (wasichai/srtm-backend#62): con observación, lo escrito o lo que
// falta, y deshabilitado (diciendo por qué) sin permiso de creación sobre las cuotas. desde la ficha del contribuyente,
// el aviso de las cuotas que quedan a nombre de otro titular. cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const base = (permisos: unknown = { admin: true, objects: {} }): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const predioFicha = {
  predio: { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', tipo_predio: 'PREDIO URBANO' },
  titulares: 1,
  totales: { autoavaluo: 0, valor_afecto: 0 }
}

const matriz = (valores: Partial<MatrizArbitrios> = {}): MatrizArbitrios => ({
  anio: year,
  predio: { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123' },
  filas: [
    {
      servicio: { id: 's1', codigo: 'LIMPIEZA', nombre: 'Limpieza pública', orden: 1, vigencia_desde: `${year}-01-01`, vigencia_hasta: null },
      meses: Array.from({ length: 12 }, () => null),
      total: 0
    }
  ],
  titulares: Array.from({ length: 12 }, (_, i) => ({ periodo: i + 1, titular: { id: 'c1', codigo: '000001', nombre: 'ANA' } })),
  totales_por_mes: Array.from({ length: 12 }, () => 0),
  total: 0,
  fecha_calculo: null,
  pendientes: 12,
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

function start(path: string, routes: MockRoute[], permisos?: unknown) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...routes, ...base(permisos)])
  render(<PortalApp />)
}

const delPredio = (post: Omit<MockRoute, 'path'>): MockRoute[] => [
  { method: 'POST', ...post, path: '/srtm/predios/p1/arbitrios' },
  { path: '/srtm/predios/p1/arbitrios', body: matriz() },
  { path: '/srtm/predios/p1', body: predioFicha }
]

const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/predios/p1/arbitrios')).length

async function determinar(observacion: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Determinar arbitrios ${year}` }))
  const dialogo = await screen.findByRole('dialog')
  const boton = within(dialogo).getByRole('button', { name: 'Determinar' })
  expect(boton).toBeDisabled()
  await userEvent.type(within(dialogo).getByLabelText('Observación'), observacion)
  return { dialogo, boton }
}

describe('determinar desde la ficha del predio', () => {
  it('asks why, writes the pending cuotas and reads the year again', async () => {
    const escritas = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, periodo: i + 1 }))
    start('/predios/p1?tab=arbitrios', delPredio({ status: 201, body: escritas }))
    const { dialogo, boton } = await determinar('Ordenanza del año')
    const antes = lecturas()
    await userEvent.click(boton)
    expect(await within(dialogo).findByText('Se determinaron 12 cuotas.')).toBeInTheDocument()
    const post = fetch!.calls.find((c) => c.method === 'POST')!
    expect(post.body).toEqual({ anio: year, observacion: 'Ordenanza del año' })
    expect(lecturas()).toBeGreaterThan(antes)
  })

  it('a short observación cannot be sent', async () => {
    start('/predios/p1?tab=arbitrios', delPredio({ status: 201, body: [] }))
    const { boton } = await determinar('  ok ')
    expect(boton).toBeDisabled()
  })

  it('says when nothing was pending', async () => {
    start('/predios/p1?tab=arbitrios', delPredio({ status: 200, body: [] }))
    const { dialogo, boton } = await determinar('Ordenanza del año')
    await userEvent.click(boton)
    expect(await within(dialogo).findByText('No había cuotas pendientes: nada que determinar.')).toBeInTheDocument()
  })

  it('names what is missing when the backend cannot determine', async () => {
    const detalle = `No se pueden determinar los arbitrios de ${year}: TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`
    start('/predios/p1?tab=arbitrios', delPredio({ status: 422, body: { title: 'Unprocessable Content', detail: detalle, faltan: [] } }))
    const { dialogo, boton } = await determinar('Ordenanza del año')
    await userEvent.click(boton)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(`TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`)
  })

  it('links what is missing to the declaración that fixes it, when the backend says which one', async () => {
    const detalle = `No se pueden determinar los arbitrios de ${year}: Frontis del predio 01-01-0001`
    start(
      '/predios/p1?tab=arbitrios',
      delPredio({
        status: 422,
        body: {
          title: 'Unprocessable Content',
          detail: detalle,
          faltan: ['Frontis del predio 01-01-0001'],
          faltan_detalle: [{ mensaje: 'Frontis del predio 01-01-0001', predio: 'p1', declaracion: 'd1' }]
        }
      })
    )
    const { dialogo, boton } = await determinar('Ordenanza del año')
    await userEvent.click(boton)
    const alerta = await within(dialogo).findByRole('alert')
    expect(within(alerta).getByRole('link', { name: 'Frontis del predio 01-01-0001' })).toHaveAttribute('href', '/declaraciones/d1?tab=caracteristicas')
  })

  it('without CREATE on the cuotas the action is disabled, and says why', async () => {
    start('/predios/p1?tab=arbitrios', delPredio({ status: 403, body: {} }), { admin: false, objects: { cuota_arbitrio: ['READ'], predio: ['READ'] } })
    expect(await screen.findByRole('button', { name: `Determinar arbitrios ${year}` })).toBeDisabled()
    expect(screen.getByText('Sin permiso: determinar pide creación sobre las cuotas de arbitrio.')).toBeInTheDocument()
  })
})

describe('determinar desde la ficha del contribuyente', () => {
  it('warns of the cuotas that go to another titular before writing them', async () => {
    const vendido = matriz({
      titulares: Array.from({ length: 12 }, (_, i) => ({
        periodo: i + 1,
        titular: i < 5 ? { id: 'c1', codigo: '000001', nombre: 'ANA' } : { id: 'c2', codigo: '000002', nombre: 'BETO' }
      }))
    })
    start('/contribuyentes/c1?tab=arbitrios', [
      {
        path: '/srtm/contribuyentes/c1/arbitrios',
        body: { anio: year, contribuyente: { id: 'c1', codigo: '000001', nombre: 'ANA' }, predios: [vendido], total: 0, fecha_calculo: null }
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
    const { dialogo } = await determinar('Ordenanza del año')
    expect(
      within(dialogo).getByText('Las cuotas del predio 01-01-0001 de JUN–DIC quedarán a nombre de 000002 · BETO: es su titular principal.')
    ).toBeInTheDocument()
  })
})
