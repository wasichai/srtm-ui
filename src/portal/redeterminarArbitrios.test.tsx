import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { rentas } from './api'
import { AvisosDeArbitrios, DURACION_AVISO } from './components/AvisosDeArbitrios'
import { escucharRedeterminaciones, leerResultadoRedeterminacion, mensajesDeRedeterminacion, publicarRedeterminacion } from './components/avisoArbitrios'
import { PortalApp } from './PortalApp'
import type { MatrizArbitrios, ResultadoRedeterminacion } from './types'

// la redeterminación de los arbitrios de un predio (wasichai/srtm-backend#158): el encabezado Srtm-Arbitrios de una
// escritura de la DJ, leído y publicado; el aviso que lo muestra y lo que vuelve a leer; y el botón «Redeterminar
// arbitrios» de la ficha del predio. cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// mockFetch answers no headers of its own: the routes `con` matches carry Srtm-Arbitrios
function conEncabezado(con: (method: string, url: string) => boolean, valor: string) {
  const anterior = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const respuesta = await anterior(input, init)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!con((init?.method ?? 'GET').toUpperCase(), url)) return respuesta
    const headers = new Headers(respuesta.headers)
    headers.set('Srtm-Arbitrios', valor)
    return new Response(respuesta.status === 204 ? null : await respuesta.text(), { status: respuesta.status, headers })
  }
}

// what Jackson writes with ESCAPE_NON_ASCII
const ESCAPADO = '{"redeterminadas":0,"anuladas":0,"error":"Redeterminar arbitrios exige permiso de creaci\\u00f3n sobre cuota_arbitrio"}'

describe('el encabezado Srtm-Arbitrios', () => {
  it('reads the counts and the error, non-ascii escaped', () => {
    expect(leerResultadoRedeterminacion('{"redeterminadas":12,"anuladas":12,"error":null}')).toEqual({ redeterminadas: 12, anuladas: 12, error: null })
    expect(leerResultadoRedeterminacion(ESCAPADO)?.error).toBe('Redeterminar arbitrios exige permiso de creación sobre cuota_arbitrio')
  })

  it('absent or unreadable, nothing', () => {
    expect(leerResultadoRedeterminacion(null)).toBeNull()
    expect(leerResultadoRedeterminacion('')).toBeNull()
    expect(leerResultadoRedeterminacion('no es json')).toBeNull()
    expect(leerResultadoRedeterminacion('null')).toBeNull()
  })

  it('says what changed, why it could not, or nothing', () => {
    expect(mensajesDeRedeterminacion({ redeterminadas: 12, anuladas: 3, error: null })).toEqual([
      { tono: 'success', texto: 'Se redeterminaron 12 cuotas de arbitrios del año (3 anuladas).' }
    ])
    expect(mensajesDeRedeterminacion({ redeterminadas: 1, anuladas: 1 }, 2026)).toEqual([
      { tono: 'success', texto: 'Se redeterminó 1 cuota de arbitrios de 2026 (1 anulada).' }
    ])
    expect(mensajesDeRedeterminacion({ redeterminadas: 0, anuladas: 0, error: 'sin permiso' })).toEqual([
      { tono: 'warning', texto: 'Los arbitrios no se redeterminaron: sin permiso' }
    ])
    expect(mensajesDeRedeterminacion({ redeterminadas: 0, anuladas: 0, error: null })).toEqual([])
  })
})

describe('una escritura de la DJ publica lo que hizo a los arbitrios', () => {
  const escuchar = () => {
    const oidos: ResultadoRedeterminacion[] = []
    const dejar = escucharRedeterminaciones((r) => oidos.push(r))
    return { oidos, dejar }
  }

  it('a row written (PUT) and removed (DELETE 204)', async () => {
    localStorage.setItem('srtm.token', 't')
    fetch = mockFetch([
      { method: 'PUT', path: '/srtm/niveles/n1', body: { id: 'n1' } },
      { method: 'DELETE', path: '/srtm/niveles/n1', status: 204 }
    ])
    conEncabezado(() => true, '{"redeterminadas":12,"anuladas":12,"error":null}')
    const { oidos, dejar } = escuchar()
    await rentas.niveles.actualizar('n1', { id: 'n1' } as never)
    await rentas.niveles.borrar('n1')
    dejar()
    expect(oidos).toEqual([
      { redeterminadas: 12, anuladas: 12, error: null },
      { redeterminadas: 12, anuladas: 12, error: null }
    ])
    // the DELETE keeps its token
    expect(fetch.calls.find((c) => c.method === 'DELETE')?.headers.authorization).toBe('Bearer t')
  })

  it('the declaración written (POST), with the error', async () => {
    fetch = mockFetch([{ method: 'POST', path: '/srtm/declaraciones/d1/anular', body: { id: 'd1' } }])
    conEncabezado(() => true, ESCAPADO)
    const { oidos, dejar } = escuchar()
    await rentas.anularDeclaracion('d1', 'Duplicada')
    dejar()
    expect(oidos[0].error).toBe('Redeterminar arbitrios exige permiso de creación sobre cuota_arbitrio')
  })

  it('without the header, nothing', async () => {
    fetch = mockFetch([{ method: 'PUT', path: '/srtm/declaraciones/d1', body: { id: 'd1' } }])
    const { oidos, dejar } = escuchar()
    await rentas.actualizarDeclaracion('d1', { id: 'd1' } as never)
    dejar()
    expect(oidos).toEqual([])
  })

  it('a failed removal still says why', async () => {
    fetch = mockFetch([{ method: 'DELETE', path: '/srtm/niveles/n1', status: 409, body: { title: 'Conflict', detail: 'La declaración está anulada' } }])
    await expect(rentas.niveles.borrar('n1')).rejects.toMatchObject({ status: 409, message: 'La declaración está anulada' })
  })
})

describe('el aviso de arbitrios', () => {
  function montar() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
    render(
      <QueryClientProvider client={queryClient}>
        <AvisosDeArbitrios />
      </QueryClientProvider>
    )
    return { invalidar }
  }

  it('shows the cuotas redetermined, reads the arbitrios again and fades', () => {
    vi.useFakeTimers()
    const { invalidar } = montar()
    act(() => publicarRedeterminacion({ redeterminadas: 12, anuladas: 12, error: null }))
    expect(screen.getByText('Se redeterminaron 12 cuotas de arbitrios del año (12 anuladas).')).toBeInTheDocument()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['arbitrios'] })
    act(() => vi.advanceTimersByTime(DURACION_AVISO))
    expect(screen.queryByTestId('aviso-arbitrios')).not.toBeInTheDocument()
  })

  it('the error stays until it is closed', () => {
    vi.useFakeTimers()
    const { invalidar } = montar()
    act(() => publicarRedeterminacion({ redeterminadas: 0, anuladas: 0, error: 'falta la TASA_ARBITRIO' }))
    act(() => vi.advanceTimersByTime(DURACION_AVISO * 3))
    const aviso = screen.getByTestId('aviso-arbitrios')
    expect(aviso).toHaveTextContent('Los arbitrios no se redeterminaron: falta la TASA_ARBITRIO')
    // nothing changed: nothing to read again
    expect(invalidar).not.toHaveBeenCalled()
    fireEvent.click(within(aviso).getByRole('button'))
    expect(screen.queryByTestId('aviso-arbitrios')).not.toBeInTheDocument()
  })

  it('nothing redetermined and no error, no aviso', () => {
    const { invalidar } = montar()
    act(() => publicarRedeterminacion({ redeterminadas: 0, anuladas: 0, error: null }))
    expect(screen.queryByTestId('aviso-arbitrios')).not.toBeInTheDocument()
    expect(invalidar).not.toHaveBeenCalled()
  })
})

// the ficha del predio
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

const matriz: MatrizArbitrios = {
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
  pendientes: 0,
  faltan: []
}

function start(post: Omit<MockRoute, 'path'>, permisos?: unknown) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', '/predios/p1?tab=arbitrios')
  fetch = mockFetch([
    { method: 'POST', ...post, path: '/srtm/predios/p1/arbitrios/redeterminacion' },
    { path: '/srtm/predios/p1/arbitrios', body: matriz },
    { path: '/srtm/predios/p1', body: predioFicha },
    ...base(permisos)
  ])
  render(<PortalApp />)
}

const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/predios/p1/arbitrios')).length

async function redeterminar(observacion: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Redeterminar arbitrios' }))
  const dialogo = await screen.findByRole('dialog')
  const boton = within(dialogo).getByRole('button', { name: 'Redeterminar' })
  expect(boton).toBeDisabled()
  await userEvent.type(within(dialogo).getByLabelText('Observación'), observacion)
  return { dialogo, boton }
}

describe('redeterminar desde la ficha del predio', () => {
  it('warns that paid cuotas are annulled too, writes the year and reads it again', async () => {
    start({ status: 200, body: { redeterminadas: 12, anuladas: 12, error: null } })
    const { dialogo, boton } = await redeterminar('Cambió el uso del predio')
    expect(within(dialogo).getByText('Las cuotas ya pagadas también se anulan: srtm no tiene registro de pagos.')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Año')).toHaveValue(String(year))
    const antes = lecturas()
    await userEvent.click(boton)
    expect(await within(dialogo).findByText(`Se redeterminaron 12 cuotas de arbitrios de ${year} (12 anuladas).`)).toBeInTheDocument()
    const post = fetch!.calls.find((c) => c.method === 'POST')!
    expect(post.body).toEqual({ anio: year, observacion: 'Cambió el uso del predio' })
    expect(lecturas()).toBeGreaterThan(antes)
  })

  it('another year, when picked', async () => {
    start({ status: 200, body: { redeterminadas: 0, anuladas: 0, error: null } })
    const { dialogo, boton } = await redeterminar('Corrección del año pasado')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Año'), String(year - 1))
    await userEvent.click(boton)
    expect(await within(dialogo).findByText(`Las cuotas de ${year - 1} ya estaban al día: nada que redeterminar.`)).toBeInTheDocument()
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ anio: year - 1, observacion: 'Corrección del año pasado' })
  })

  it('a short observación cannot be sent', async () => {
    start({ status: 200, body: { redeterminadas: 0, anuladas: 0 } })
    const { boton } = await redeterminar(' ok ')
    expect(boton).toBeDisabled()
  })

  it('says the 403', async () => {
    const detalle = 'Redeterminar arbitrios exige permiso de creación sobre cuota_arbitrio y anulacion_cuota_arbitrio'
    start({ status: 403, body: { title: 'Forbidden', detail: detalle } })
    const { dialogo, boton } = await redeterminar('Cambió el uso del predio')
    await userEvent.click(boton)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(detalle)
  })

  it('names what is missing (422)', async () => {
    const detalle = `No se pueden determinar los arbitrios de ${year}: TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`
    start({ status: 422, body: { title: 'Unprocessable Content', detail: detalle, faltan: [`TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`] } })
    const { dialogo, boton } = await redeterminar('Cambió el uso del predio')
    await userEvent.click(boton)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(`TASA_ARBITRIO LIMPIEZA:Z1:CASA ${year}`)
  })

  it('without CREATE on the anulaciones the action is disabled, and says why', async () => {
    start({ status: 403, body: {} }, { admin: false, objects: { cuota_arbitrio: ['READ', 'CREATE'], predio: ['READ'] } })
    expect(await screen.findByRole('button', { name: 'Redeterminar arbitrios' })).toBeDisabled()
    expect(screen.getByText('Sin permiso: redeterminar pide creación sobre las cuotas de arbitrio y sus anulaciones.')).toBeInTheDocument()
  })

  it('the aviso of a write of the DJ shows over the portal', async () => {
    start({ status: 200, body: {} })
    await screen.findByRole('button', { name: 'Redeterminar arbitrios' })
    const antes = lecturas()
    act(() => publicarRedeterminacion({ redeterminadas: 2, anuladas: 2, error: null }))
    expect(await screen.findByText('Se redeterminaron 2 cuotas de arbitrios del año (2 anuladas).')).toBeInTheDocument()
    await vi.waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
  })
})
