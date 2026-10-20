import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { today } from './components/format'
import { PortalApp } from './PortalApp'

// la rectificatoria (srtm-backend#151): a vigente declaración is replaced by a new one, numbered, with motivo
// RECTIFICACION; the old one stays SUSTITUIDA, read-only, linked both ways. another year is declared from the year
// before (desde), which the backend copies with its lists

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const juan = { id: 'c1', codigo: '000123', tipo_documento: 'DNI', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const predio = { id: 'p1', codigo: '01-01-0001', direccion: 'JR. LIMA 123', tipo_predio: 'PREDIO URBANO' }

const declaracion = (valores: Record<string, unknown>) => ({
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  secuencia_uso: '001',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACIÓN',
  valor_autoavaluo: 10000.5,
  ...valores
})
const vigente = declaracion({ id: 'd1', numero_declaracion: 39147, motivo: 'INSCRIPCION', estado: 'VIGENTE' })
const sustituida = declaracion({ id: 'd1', numero_declaracion: 39147, motivo: 'INSCRIPCION', estado: 'SUSTITUIDA', fecha_sustitucion: `${year}-10-20` })
const rectificatoria = declaracion({ id: 'd3', numero_declaracion: 39150, motivo: 'RECTIFICACION', estado: 'VIGENTE', sustituye: 'd1' })
const anterior = declaracion({ id: 'd0', anio: year - 1, numero_declaracion: 30001, motivo: 'INSCRIPCION', estado: 'VIGENTE' })
const ficha = (d: object) => ({ declaracion: d, predio, contribuyente: juan, actualizado: '2026-09-25T14:03:00Z' })
const fila = (d: object) => ({ declaracion: d, predio, contribuyente: juan })
const totales = { declaraciones: 1, autoavaluo: 10000.5, valor_afecto: 10000.5 }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: { declaracion_predial: { medio_presentacion: ['FISICO', 'VIRTUAL'] } } },
  { path: '/srtm/ubigeos', body: [] },
  { path: '/srtm/declaraciones/d1', body: ficha(vigente) },
  { path: '/srtm/declaraciones/d3', body: ficha(rectificatoria) },
  { path: /^\/srtm\/declaraciones\/d\d\/(transferentes|niveles|obras|frentes)$/, body: [] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente: juan, anio: year, predios: 1, totales } }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

// porAnio: a predio's declaraciones as the backend gives them by year (delPredioPorAnio)
function start(path: string, extra: MockRoute[] = [], porAnio?: { declaracion: object }[]) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  if (porAnio) delPredioPorAnio(porAnio)
  render(<PortalApp />)
}

// mockFetch matches the path alone: a predio's declaraciones of one year (?anio=, its titulares) are these, of that
// year, as the backend filters them; every year's go to the mocked route
function delPredioPorAnio(filas: { declaracion: object }[]) {
  const mocked = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    const anio = url.searchParams.get('anio')
    if (url.pathname.endsWith('/srtm/predios/p1/declaraciones') && anio) {
      return Promise.resolve(jsonResponse(filas.filter((f) => (f.declaracion as { anio?: number }).anio === Number(anio))))
    }
    return mocked(input, init)
  })
}
afterEach(() => vi.restoreAllMocks())

const called = (method: string, path: string) => fetch!.calls.find((c) => c.method === method && c.path === path)

describe('rectificar una declaración jurada', () => {
  it('rectifies a vigente declaration from its header and opens the new one in the wizard', async () => {
    start('/declaraciones/d1', [
      { path: '/srtm/predios/p1/declaraciones', body: [fila(vigente)] },
      { method: 'POST', path: '/srtm/declaraciones/d1/rectificar', status: 201, body: ficha(rectificatoria) }
    ])
    await screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })
    await userEvent.click(screen.getByRole('button', { name: 'Rectificar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rectificar la declaración jurada 39147' })
    expect(dialog).toHaveTextContent(/queda SUSTITUIDA/)
    expect(dialog).toHaveTextContent(/declaración nueva, con su propio número/)
    expect(within(dialog).getByLabelText(/Fecha de presentación/)).toHaveValue(today())
    await userEvent.selectOptions(within(dialog).getByLabelText(/Medio de presentación/), 'VIRTUAL')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rectificar' }))

    const post = await waitFor(() => {
      const call = called('POST', '/srtm/declaraciones/d1/rectificar')
      expect(call).toBeDefined()
      return call!
    })
    expect(post.body).toEqual({ medio_presentacion: 'VIRTUAL', fecha_presentacion: today() })
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/declaraciones/d3')
    expect(new URLSearchParams(window.location.search).get('asistente')).toBe('1')
  })

  it('says why the backend refuses to rectify, in the dialog', async () => {
    const detail = 'La declaración fue sustituida por una rectificatoria'
    start('/declaraciones/d1', [
      { path: '/srtm/predios/p1/declaraciones', body: [fila(vigente)] },
      { method: 'POST', path: '/srtm/declaraciones/d1/rectificar', status: 400, body: { title: 'Bad Request', detail } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Rectificar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rectificar' }))
    expect(await within(dialog).findByText(detail)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/declaraciones/d1')
  })

  it('only reads a sustituida, and links the rectificatoria that replaced it', async () => {
    start('/declaraciones/d1', [
      { path: '/srtm/declaraciones/d1', body: ficha(sustituida) },
      { path: '/srtm/predios/p1/declaraciones', body: [fila(sustituida), fila(rectificatoria)] }
    ])
    await screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })
    expect(screen.getByText('Sustituida')).toBeInTheDocument()
    const aviso = screen.getByRole('note')
    expect(aviso).toHaveTextContent(`Declaración sustituida el 20/10/${year}`)
    expect(await within(aviso).findByRole('link', { name: 'Sustituida por la DJ n° 39150' })).toHaveAttribute('href', '/declaraciones/d3')
    expect(screen.queryByRole('button', { name: 'Rectificar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular declaración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })

  it('links the rectificatoria to the declaration it replaces', async () => {
    start('/declaraciones/d3', [{ path: '/srtm/predios/p1/declaraciones', body: [fila(sustituida), fila(rectificatoria)] }])
    await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })
    expect(await screen.findByRole('link', { name: 'Sustituye a la DJ n° 39147' })).toHaveAttribute('href', '/declaraciones/d1')
    expect(screen.getByRole('button', { name: 'Rectificar' })).toBeInTheDocument()
  })

  it('names a declaration of the padrón (without number) it replaces by its year', async () => {
    const importada = declaracion({ id: 'd1', numero_declaracion: null, motivo: 'INSCRIPCION', estado: 'SUSTITUIDA' })
    start('/declaraciones/d3', [{ path: '/srtm/predios/p1/declaraciones', body: [fila(importada), fila(rectificatoria)] }])
    await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })
    expect(await screen.findByRole('link', { name: `Sustituye a la DJ del padrón (${year})` })).toHaveAttribute('href', '/declaraciones/d1')
    expect(screen.queryByText(/sin número/)).not.toBeInTheDocument()
  })

  it("marks the sustituidas among a contribuyente's declarations", async () => {
    start('/contribuyentes/c1?tab=declaraciones', [{ path: '/srtm/contribuyentes/c1/declaraciones', body: [fila(rectificatoria), fila(sustituida)] }])
    const vieja = (await screen.findByRole('link', { name: '39147' })).closest('tr')!
    expect(vieja).toHaveTextContent('Sustituida')
    const nueva = screen.getByRole('link', { name: '39150' }).closest('tr')!
    expect(nueva).not.toHaveTextContent('Sustituida')
  })

  it("leaves a sustituida out of the predio's condóminos", async () => {
    start('/declaraciones/d3?tab=condominos', [{ path: '/srtm/predios/p1/declaraciones', body: [fila(sustituida), fila(rectificatoria)] }])
    expect(await screen.findByText(/suman 100 % de propiedad/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'QUISPE MAMANI JUAN' })).toHaveLength(1)
  })
})

// the wizard from the predio, to the ubicación step: the predio is fixed, the contribuyente looked up
async function hastaLaUbicacion() {
  expect(await screen.findByLabelText('Código de predio')).toHaveValue('01-01-0001')
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
  await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
  await userEvent.type(screen.getByLabelText(/Folios/), '2')
  await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
  await userEvent.type(screen.getByLabelText(/Contribuyente/), 'quispe')
  await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
}

const nueva = declaracion({ id: 'd4', numero_declaracion: 39151, motivo: 'INSCRIPCION', estado: 'VIGENTE' })
const asistente: MockRoute[] = [
  { path: '/srtm/catalogos', body: { declaracion_predial: { tipo_adquisicion: ['COMPRA'] } } },
  { path: '/srtm/contribuyentes', body: { content: [juan], page: 0, size: 8, totalElements: 1, totalPages: 1 } },
  { path: '/srtm/declaraciones/d4', body: ficha(nueva) }
]

describe('declarar otro año desde la declaración anterior', () => {
  it("offers the contribuyente's most recent declaración of another year, and presents from it", async () => {
    const antigua = declaracion({ id: 'dx', anio: year - 3, numero_declaracion: 20001, estado: 'VIGENTE' })
    const anulada = declaracion({ id: 'dy', anio: year - 1, numero_declaracion: 30002, estado: 'ANULADA' })
    start(
      '/declaraciones/nueva?predio=p1',
      [
        ...asistente,
        { path: '/srtm/predios/p1/declaraciones', body: [fila(antigua), fila(anterior), fila(anulada)] },
        { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: ficha(nueva) }
      ],
      [fila(antigua), fila(anterior), fila(anulada)]
    )
    await hastaLaUbicacion()
    const desde = await screen.findByRole('button', { name: `Declarar desde la DJ ${year - 1}` })
    expect(screen.getByText(/se copian las características, los niveles, las obras y los otros frentes/)).toBeInTheDocument()
    expect(screen.getByText(/y el autoavalúo/)).toBeInTheDocument()
    await userEvent.click(desde)
    const post = await waitFor(() => {
      const call = called('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')
      expect(call).toBeDefined()
      return call!
    })
    expect(post.body).toMatchObject({ predio_id: 'p1', desde: 'd0', declaracion: { anio: year } })
    await waitFor(() => expect(window.location.pathname).toBe('/declaraciones/d4'))
  })

  it('declares from it in step one, without filling datos del predio: only the año and the presentación go', async () => {
    const importada = { ...anterior, numero_declaracion: null }
    start(
      '/declaraciones/nueva?predio=p1',
      [
        ...asistente,
        { path: '/srtm/predios/p1/declaraciones', body: [fila(importada)] },
        { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: ficha(nueva) }
      ],
      [fila(importada)]
    )
    expect(await screen.findByLabelText('Código de predio')).toHaveValue('01-01-0001')
    expect(screen.queryByRole('button', { name: /Declarar desde la DJ/ })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Contribuyente/), 'quispe')
    await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
    const desde = await screen.findByRole('button', { name: `Declarar desde la DJ ${year - 1}` })
    expect(screen.getByRole('tab', { name: 'Datos del predio' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(new RegExp(`declaró este predio en ${year - 1} \\(DJ del padrón\\)`))).toBeInTheDocument()
    await userEvent.click(desde)
    const post = await waitFor(() => {
      const call = called('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')
      expect(call).toBeDefined()
      return call!
    })
    expect(post.body).toEqual({ predio_id: 'p1', desde: 'd0', declaracion: { anio: year, medio_presentacion: 'FISICO', fecha_presentacion: today() } })
    await waitFor(() => expect(window.location.pathname).toBe('/declaraciones/d4'))
  })

  it('presents without desde from Siguiente', async () => {
    start(
      '/declaraciones/nueva?predio=p1',
      [
        ...asistente,
        { path: '/srtm/predios/p1/declaraciones', body: [fila(anterior)] },
        { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: ficha(nueva) }
      ],
      [fila(anterior)]
    )
    await hastaLaUbicacion()
    await screen.findByRole('button', { name: `Declarar desde la DJ ${year - 1}` })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const post = await waitFor(() => called('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')!)
    expect(post.body).not.toHaveProperty('desde')
  })

  it('offers nothing when the contribuyente has no other year of the predio', async () => {
    const otro = { ...anterior, contribuyente: 'c2' }
    start('/declaraciones/nueva?predio=p1', [...asistente, { path: '/srtm/predios/p1/declaraciones', body: [{ ...fila(otro), contribuyente: null }] }])
    await hastaLaUbicacion()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/srtm/predios/p1/declaraciones')).toBe(true))
    expect(screen.queryByRole('button', { name: /Declarar desde la DJ/ })).not.toBeInTheDocument()
  })

  it("shows the backend's refusal of the same year under the año", async () => {
    const message = 'es el año de la declaración de partida: rectifíquela'
    start(
      '/declaraciones/nueva?predio=p1',
      [
        ...asistente,
        { path: '/srtm/predios/p1/declaraciones', body: [fila(anterior)] },
        {
          method: 'POST',
          path: '/srtm/contribuyentes/c1/declaraciones-juradas',
          status: 400,
          body: { title: 'En el mismo año corresponde rectificar la declaración', errors: [{ field: 'anio', message }] }
        }
      ],
      [fila(anterior)]
    )
    await hastaLaUbicacion()
    await userEvent.click(await screen.findByRole('button', { name: `Declarar desde la DJ ${year - 1}` }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datos del predio' })).toHaveAttribute('aria-selected', 'true')
  })
})
