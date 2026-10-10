import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { SRTM_THEMES } from '../themes'
import { PortalApp } from './PortalApp'
import { EstadoAnuncioBadge } from './components/EstadoAnuncioBadge'
import { claves } from './queries'
import type { Anuncio, AnuncioEnPadron, FichaAnuncio, MovimientoAnuncio } from './types'

// la tasa de anuncios y propaganda (épica de infracciones y anuncios, PR U6): el padrón con el estado a una fecha, el
// alta con su autorización, la ficha con sus movimientos y los tres actos (renovar, cesar, retirar), las tasas del año
// y la pestaña Anuncios de las fichas. el estado, la vigencia y la tasa son del backend, nunca de la pantalla; el
// reenvío del alta manda el mismo Idempotency-Key; lo que falta lo nombra una Alert, nunca un 0. cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dmy = (iso: string) => iso.split('-').reverse().join('/')
const page = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const base = (permisos: unknown = { admin: true, objects: {} }, theme = 'system'): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme, locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } },
  {
    path: '/srtm/contribuyentes',
    body: page([{ id: 'c1', numero_documento: '12345678', nombre_completo: 'ANA FICTICIA' }])
  },
  { path: '/srtm/predios', body: page([{ id: 'p1', codigo: '01-01-0001', direccion: 'JR. FICTICIO 123' }]) }
]

const anuncio = (valores: Partial<Anuncio> = {}): Anuncio => ({
  id: 'a1',
  anio: year,
  correlativo: 1,
  numero: `AN-${year}-000001`,
  clase: 'PANEL',
  tipo: 'AVISO_LUMINOSO',
  emplazamiento: 'FACHADA',
  forma: 'RECTANGULAR',
  denominacion: 'BODEGA FICTICIA',
  direccion: 'JR. FICTICIO 123',
  area: 4.5,
  lados: 2,
  cantidad: 1,
  fecha_autorizacion: `${year}-01-10`,
  vigencia_hasta: `${year}-12-31`,
  expediente: 'EXP-000001',
  fecha_expediente: `${year}-01-05`,
  licencia_texto: null,
  observacion: 'Autorización ficticia',
  contribuyente: 'c1',
  predio: null,
  ...valores
})

const movimiento = (valores: Partial<MovimientoAnuncio> = {}): MovimientoAnuncio => ({
  id: 'm1',
  tipo: 'AUTORIZACION',
  fecha: `${year}-01-10`,
  anio: year,
  referencia_cargo: `ANUNCIO-a1-${year}`,
  // the backend's copy of the tasa: not area × anything, on purpose
  tasa: 77.77,
  vigencia_hasta: `${year}-12-31`,
  motivo: null,
  clave: 'a1|AUTORIZACION',
  observacion: 'Autorización ficticia',
  anuncio: 'a1',
  parametro: 'p-tasa',
  ...valores
})

const enPadron = (valores: Partial<AnuncioEnPadron> = {}): AnuncioEnPadron => ({
  ...anuncio(),
  contribuyente_nombre: 'ANA FICTICIA',
  // the backend says VIGENTE although its vigencia ended: the screen shows its estado, it does not derive one
  estado: 'VIGENTE',
  vigencia_hasta_vigente: `${year - 1}-12-31`,
  vigentes_a: hoy(),
  ...valores
})

const ficha = (valores: Partial<FichaAnuncio> = {}): FichaAnuncio => ({
  anuncio: anuncio(),
  movimientos: [movimiento()],
  estado: 'VIGENTE',
  vigencia_hasta_vigente: `${year}-12-31`,
  al_dia: hoy(),
  devengado: { importe: 77.77, al_dia: hoy() },
  ...valores
})

const cesado = () =>
  ficha({
    estado: 'CESADO',
    movimientos: [
      movimiento(),
      movimiento({
        id: 'm2',
        tipo: 'CESE',
        fecha: `${year}-02-01`,
        anio: null,
        referencia_cargo: null,
        tasa: null,
        vigencia_hasta: null,
        motivo: 'Cierre ficticio del local',
        clave: 'a1|CESE',
        observacion: 'Cese ficticio',
        parametro: null
      })
    ]
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
  delete document.documentElement.dataset.theme
})

function start(path: string, routes: MockRoute[], { permisos, theme }: { permisos?: unknown; theme?: string } = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  if (theme) localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', path)
  fetch = mockFetch([...routes, ...base(permisos, theme)])
  render(<PortalApp />)
}

// mockFetch does not keep headers: the POSTs of the alta are answered here, in order, keeping each one's
// Idempotency-Key and body; the rest goes on to mockFetch
function altas(respuestas: (() => Promise<Response>)[]) {
  const enviadas: { clave: string | null; cuerpo: Record<string, unknown> }[] = []
  const siguiente = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (init?.method === 'POST' && url === '/api/srtm/anuncios') {
      enviadas.push({ clave: new Headers(init.headers).get('Idempotency-Key'), cuerpo: JSON.parse(String(init.body)) as Record<string, unknown> })
      return respuestas.shift()!()
    }
    return siguiente(input, init)
  }) as typeof globalThis.fetch
  return enviadas
}

const json = (body: unknown, status: number) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const registrado = (ya_existia: boolean) => ({ anuncio: anuncio(), movimiento: movimiento(), ya_existia })

const lecturas = (prefijo: string) => fetch!.calls.filter((c) => c.method === 'GET' && c.path.split('?')[0] === prefijo)

describe('padrón de anuncios', () => {
  it("shows the backend's estado and vigencia at vigentes_a, even when the dates suggest otherwise", async () => {
    start('/anuncios', [{ path: '/srtm/anuncios', body: page([enPadron()]) }])
    const t = await screen.findByRole('table', { name: `Anuncios al ${dmy(hoy())}` })
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Número', 'Titular', 'Clase', 'Tipo', 'Dirección', 'Área m²', 'Vigente hasta', 'Estado'])
    const [, fila] = within(t).getAllByRole('row')
    const celdas = within(fila)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(celdas.slice(0, 4)).toEqual([`AN-${year}-000001`, 'ANA FICTICIA', 'Panel', 'Aviso luminoso'])
    expect(celdas[5]).toMatch(/^4[.,]5$/)
    expect(celdas[6]).toBe(`31/12/${year - 1}`)
    // the vigencia ended, yet the backend says vigente: no "Vencido" of the screen's own
    expect(celdas[7]).toBe('Vigente')
    expect(within(fila).queryByText('Vencido')).not.toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: `AN-${year}-000001` })).toHaveAttribute('href', '/anuncios/a1')
    expect(screen.getByTestId('padron-al')).toHaveTextContent(`Estado y vigencia al ${dmy(hoy())}.`)
    // asked for today by default
    expect(new URLSearchParams(lecturas('/srtm/anuncios')[0].path.split('?')[1]).get('vigentes_a')).toBe(hoy())
  })

  it('shows «—» as the vigencia of the cesados and retirados, never their last term', async () => {
    start('/anuncios', [
      {
        path: '/srtm/anuncios',
        body: page([
          enPadron({ id: 'a1', numero: `AN-${year}-000001`, estado: 'CESADO', vigencia_hasta_vigente: `${year}-12-31` }),
          enPadron({ id: 'a2', numero: `AN-${year}-000002`, estado: 'RETIRADO', vigencia_hasta_vigente: `${year}-12-31` }),
          enPadron({ id: 'a3', numero: `AN-${year}-000003`, estado: 'VENCIDO', vigencia_hasta_vigente: null })
        ])
      }
    ])
    const t = await screen.findByRole('table', { name: `Anuncios al ${dmy(hoy())}` })
    expect(
      within(t)
        .getAllByRole('row')
        .slice(1)
        .map((r) =>
          within(r)
            .getAllByRole('cell')
            .slice(6)
            .map((c) => c.textContent)
        )
    ).toEqual([
      ['—', 'Cesado'],
      ['—', 'Retirado'],
      ['Sin plazo', 'Vencido']
    ])
  })

  it('filters by titular, clase, estado, date and text', async () => {
    start('/anuncios', [{ path: '/srtm/anuncios', body: page([enPadron()]) }])
    await screen.findByRole('table')
    await userEvent.type(screen.getByLabelText(/^Titular/), 'AN')
    await userEvent.click(await screen.findByRole('button', { name: '12345678 · ANA FICTICIA' }))
    await userEvent.selectOptions(screen.getByLabelText('Clase'), 'TOLDO')
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'VENCIDO')
    fireEvent.change(screen.getByLabelText('Estado al'), { target: { value: `${year}-02-15` } })
    await userEvent.type(screen.getByLabelText('Número, denominación o dirección'), ' bodega ')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(lecturas('/srtm/anuncios')).toHaveLength(2))
    const params = new URLSearchParams(lecturas('/srtm/anuncios')[1].path.split('?')[1])
    expect(Object.fromEntries(params)).toEqual({
      contribuyente: 'c1',
      clase: 'TOLDO',
      estado: 'VENCIDO',
      vigentes_a: `${year}-02-15`,
      q: 'bodega',
      page: '0',
      size: '20'
    })
  })

  it('keeps its queries under the anuncios keys', () => {
    expect(claves.anuncios).toEqual(['anuncios'])
    expect(claves.padronAnuncios({ estado: 'VIGENTE', vigentes_a: `${year}-02-15` }, 2)).toEqual([
      'anuncios',
      'padron',
      null,
      null,
      'VIGENTE',
      `${year}-02-15`,
      null,
      2
    ])
    expect(claves.anuncio('a1')).toEqual(['anuncios', 'ficha', 'a1'])
    expect(claves.tasasAnuncios(year)).toEqual(['anuncios', 'tasas', year])
    expect(claves.anunciosDe('predios', 'p1')).toEqual(['anuncios', 'predios', 'p1'])
  })
})

// the form filled with what the alta asks: titular, clase, tipo, dirección, área and the observación
async function llenarAlta() {
  await userEvent.type(screen.getByLabelText(/^Titular/), 'AN')
  await userEvent.click(await screen.findByRole('button', { name: '12345678 · ANA FICTICIA' }))
  await userEvent.selectOptions(screen.getByLabelText('Clase'), 'PANEL')
  await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'AVISO_LUMINOSO')
  await userEvent.type(screen.getByLabelText('Dirección'), 'JR. FICTICIO 123')
  await userEvent.type(screen.getByLabelText('Área m²'), '4.5')
  await userEvent.type(screen.getByLabelText('Observación'), 'Autorización ficticia')
}

const registrar = () => screen.getByRole('button', { name: 'Registrar anuncio' })

describe('nuevo anuncio', () => {
  it('resends the same Idempotency-Key when the first answer is lost, and never sends a tasa', async () => {
    start('/anuncios/nuevo', [])
    const enviadas = altas([() => Promise.reject(new TypeError('Failed to fetch')), json({ title: 'Service Unavailable' }, 503), json(registrado(false), 201)])
    await llenarAlta()
    await userEvent.click(registrar())
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(registrar())
    await waitFor(() => expect(enviadas).toHaveLength(2))
    await waitFor(() => expect(registrar()).toBeEnabled())
    await userEvent.click(registrar())

    expect(await screen.findByText(`Anuncio AN-${year}-000001 registrado.`)).toBeInTheDocument()
    expect(enviadas).toHaveLength(3)
    const [primera] = enviadas
    expect(primera.clave).toMatch(/^[0-9a-f-]{36}$/)
    expect(enviadas.map((e) => e.clave)).toEqual([primera.clave, primera.clave, primera.clave])
    expect(primera.cuerpo).toEqual({
      contribuyente: 'c1',
      predio: null,
      clase: 'PANEL',
      tipo: 'AVISO_LUMINOSO',
      emplazamiento: null,
      forma: null,
      denominacion: null,
      direccion: 'JR. FICTICIO 123',
      area: 4.5,
      lados: 1,
      cantidad: 1,
      fecha_autorizacion: hoy(),
      vigencia_hasta: null,
      expediente: null,
      fecha_expediente: null,
      licencia_texto: null,
      observacion: 'Autorización ficticia'
    })
    expect(Object.keys(primera.cuerpo)).not.toContain('tasa')
    // the tasa is the backend's, with its date
    expect(screen.getByText(/devenga S\/\s?77[.,]77 del ejercicio/)).toHaveTextContent(`(tasa al ${dmy(`${year}-01-10`)})`)
    expect(screen.getByRole('link', { name: 'Ver la ficha del anuncio' })).toHaveAttribute('href', '/anuncios/a1')
  })

  it('another anuncio gets a key of its own', async () => {
    start('/anuncios/nuevo', [])
    const enviadas = altas([json(registrado(false), 201), json({ ...registrado(false), anuncio: anuncio({ id: 'a2', numero: `AN-${year}-000002` }) }, 201)])
    await llenarAlta()
    await userEvent.click(registrar())
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar otro anuncio' }))
    expect(screen.getByLabelText('Dirección')).toHaveValue('')
    await llenarAlta()
    await userEvent.click(registrar())
    expect(await screen.findByText(`Anuncio AN-${year}-000002 registrado.`)).toBeInTheDocument()
    expect(enviadas[0].clave).not.toBe(enviadas[1].clave)
  })

  it('says it was registered already when the backend answers the first one (200, ya_existia)', async () => {
    start('/anuncios/nuevo', [])
    altas([json(registrado(true), 200)])
    await llenarAlta()
    await userEvent.click(registrar())
    expect(await screen.findByText(`El anuncio AN-${year}-000001 ya estaba registrado.`)).toBeInTheDocument()
    expect(screen.getByText('Este envío repetía uno anterior: no se registró otro ni se devengó otra vez.')).toBeInTheDocument()
    expect(screen.queryByText(/devenga S\//)).not.toBeInTheDocument()
  })

  it('names the missing tasa with an Alert, never a 0', async () => {
    start('/anuncios/nuevo', [])
    altas([json({ title: 'Unprocessable Content', detail: 'No hay tasa para la clase', faltan: [`TASA_ANUNCIO PANEL ${year}`] }, 422)])
    await llenarAlta()
    await userEvent.click(registrar())
    const alerta = await screen.findByText('No se puede autorizar: falta')
    expect(alerta.closest('[data-slot="alert"]')).toHaveTextContent(
      `TASA_ANUNCIO PANEL ${year}. Sin la tasa de la clase el anuncio no se autoriza, y nunca a 0.`
    )
    expect(alerta.closest('[data-slot="alert"]')).toHaveAttribute('data-tone', 'warning')
    expect(document.body.textContent).not.toMatch(/S\/\s?0[.,]00/)
    // the form is still there, to retry
    expect(registrar()).toBeEnabled()
  })

  it('without CREATE on anuncio it is impeded, and says why', async () => {
    start('/anuncios/nuevo', [], { permisos: { admin: false, objects: { anuncio: ['READ'] } } })
    await llenarAlta()
    expect(registrar()).toBeDisabled()
    expect(screen.getByText('Sin permiso: autorizar un anuncio pide creación sobre los anuncios.')).toBeInTheDocument()
  })
})

const fichaEn = async () => screen.findByRole('table', { name: 'Movimientos del anuncio' })
const acto = (name: string) => screen.getByRole('button', { name })

describe('ficha del anuncio', () => {
  it('shows its data, its movimientos with the tasa and its date, and the estado and devengado at al_dia', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: cesado() }])
    const t = await fichaEn()
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Acto', 'Fecha', 'Ejercicio', 'Referencia de cargo', 'Tasa', 'Vigente hasta', 'Motivo', 'Observación'])
    const [, autorizacion, cese] = within(t).getAllByRole('row')
    const celdas = within(autorizacion)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(celdas.slice(0, 4)).toEqual(['Autorización', `10/01/${year}`, String(year), `ANUNCIO-a1-${year}`])
    expect(celdas[4]).toMatch(new RegExp(`^S/\\s?77[.,]77al 10/01/${year}$`))
    expect(celdas[5]).toBe(`31/12/${year}`)
    expect(within(cese).getAllByRole('cell')[0]).toHaveTextContent('Cese')
    expect(within(cese).getAllByRole('cell')[6]).toHaveTextContent('Cierre ficticio del local')
    expect(screen.getByTestId('estado-anuncio')).toHaveTextContent(`Al ${dmy(hoy())}: Cesado`)
    expect(screen.getByText(`Devengado al ${dmy(hoy())}`).nextSibling).toHaveTextContent(/S\/\s?77[.,]77/)
    // cesado: in force no longer, whatever its last term said; the day it ceased, from its movimiento
    const vigencia = screen.getByText(`Vigente hasta (al ${dmy(hoy())})`).parentElement!
    expect(vigencia).toHaveTextContent(`Vigente hasta (al ${dmy(hoy())})—cesado el 01/02/${year}`)
    expect(vigencia).not.toHaveTextContent(`31/12/${year}`)
    expect(screen.getByText('Denominación').nextSibling).toHaveTextContent('BODEGA FICTICIA')
  })

  it('says until when a vigente anuncio is in force', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha() }])
    await fichaEn()
    expect(screen.getByText(`Vigente hasta (al ${dmy(hoy())})`).parentElement).toHaveTextContent(`Vigente hasta (al ${dmy(hoy())})31/12/${year}`)
  })

  it('a retirado anuncio shows «—» and the day of its retiro, not its last term', async () => {
    const retirado = cesado()
    start('/anuncios/a1', [
      {
        path: '/srtm/anuncios/a1',
        body: {
          ...retirado,
          estado: 'RETIRADO',
          movimientos: [
            ...retirado.movimientos,
            movimiento({
              id: 'm3',
              tipo: 'RETIRO',
              fecha: `${year}-03-05`,
              anio: null,
              referencia_cargo: null,
              tasa: null,
              vigencia_hasta: null,
              motivo: 'Desmontado ficticio',
              clave: 'a1|RETIRO',
              parametro: null
            })
          ]
        }
      }
    ])
    await fichaEn()
    const vigencia = screen.getByText(`Vigente hasta (al ${dmy(hoy())})`).parentElement!
    expect(vigencia).toHaveTextContent(`Vigente hasta (al ${dmy(hoy())})—retirado el 05/03/${year}`)
    expect(vigencia).not.toHaveTextContent('cesado')
  })

  it('without its movimiento a cesado anuncio still shows «—», and no date of its own', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha({ estado: 'CESADO' }) }])
    await fichaEn()
    expect(screen.getByText(`Vigente hasta (al ${dmy(hoy())})`).parentElement).toHaveTextContent(new RegExp(`^Vigente hasta \\(al ${dmy(hoy())}\\)—$`))
  })

  it("shows the backend's estado even when the vigencia in force has passed", async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha({ vigencia_hasta_vigente: `${year - 1}-12-31` }) }])
    await fichaEn()
    expect(screen.getByTestId('estado-anuncio')).toHaveTextContent(`Al ${dmy(hoy())}: Vigente`)
    expect(screen.queryByText('Vencido')).not.toBeInTheDocument()
  })

  it('a cesado anuncio is not renewed nor ceased again, and says why; it can be retired', async () => {
    start('/anuncios/a1', [
      { path: '/srtm/anuncios/a1', body: cesado() },
      { method: 'POST', path: '/srtm/anuncios/a1/retiro', status: 201, body: movimiento({ id: 'm3', tipo: 'RETIRO', tasa: null, anio: null, fecha: hoy() }) }
    ])
    await fichaEn()
    expect(acto('Renovar')).toBeDisabled()
    expect(screen.getByText('Un anuncio cesado no se renueva.')).toBeInTheDocument()
    expect(acto('Cesar')).toBeDisabled()
    expect(screen.getByText('El anuncio ya está cesado.')).toBeInTheDocument()
    expect(acto('Retirar')).toBeEnabled()

    await userEvent.click(acto('Retirar'))
    const dialogo = await screen.findByRole('dialog', { name: `Retirar el anuncio AN-${year}-000001` })
    const enviar = within(dialogo).getByRole('button', { name: 'Retirar' })
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Retiro ficticio')
    // the motivo is still missing
    expect(enviar).toBeDisabled()
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Desmontado ficticio')
    const antes = lecturas('/srtm/anuncios/a1').length
    await userEvent.click(enviar)
    expect(await within(dialogo).findByRole('status')).toHaveTextContent(`Retiro registrado el ${dmy(hoy())}.`)
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ motivo: 'Desmontado ficticio', observacion: 'Retiro ficticio' })
    await waitFor(() => expect(lecturas('/srtm/anuncios/a1').length).toBeGreaterThan(antes))
  })

  it('a vigente anuncio is not retired before its cese, and says why', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha() }])
    await fichaEn()
    expect(acto('Renovar')).toBeEnabled()
    expect(acto('Cesar')).toBeEnabled()
    expect(acto('Retirar')).toBeDisabled()
    expect(screen.getByText('Se retira después del cese: el anuncio no está cesado.')).toBeInTheDocument()
  })

  it('a retirado anuncio admits no act', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha({ estado: 'RETIRADO' }) }])
    await fichaEn()
    expect(acto('Renovar')).toBeDisabled()
    expect(acto('Cesar')).toBeDisabled()
    expect(acto('Retirar')).toBeDisabled()
    expect(screen.getByText('Un anuncio retirado no se renueva.')).toBeInTheDocument()
    expect(screen.getAllByText('El anuncio ya está retirado.')).toHaveLength(2)
  })

  it("follows the backend's acciones when it sends them", async () => {
    const acciones = {
      renovacion: { permitida: false, motivo: `El ejercicio ${year} ya está devengado.` },
      cese: { permitida: true, motivo: null },
      retiro: { permitida: false, motivo: 'Sin cese previo.' }
    }
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha({ estado: 'VENCIDO', acciones }) }])
    await fichaEn()
    expect(acto('Renovar')).toBeDisabled()
    expect(screen.getByText(`El ejercicio ${year} ya está devengado.`)).toBeInTheDocument()
    expect(screen.getByText('Sin cese previo.')).toBeInTheDocument()
  })

  it('renews with the new vigencia and shows what the backend accrued', async () => {
    const renovacion = movimiento({ id: 'm2', tipo: 'RENOVACION', fecha: hoy(), anio: year + 1, referencia_cargo: `ANUNCIO-a1-${year + 1}`, tasa: 88.88 })
    start('/anuncios/a1', [
      { path: '/srtm/anuncios/a1', body: ficha({ estado: 'VENCIDO' }) },
      { method: 'POST', path: '/srtm/anuncios/a1/renovacion', status: 201, body: renovacion }
    ])
    await fichaEn()
    await userEvent.click(acto('Renovar'))
    const dialogo = await screen.findByRole('dialog', { name: `Renovar el anuncio AN-${year}-000001` })
    fireEvent.change(within(dialogo).getByLabelText('Nueva vigencia hasta'), { target: { value: `${year + 1}-12-31` } })
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Renovación ficticia')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Renovar' }))
    expect(await within(dialogo).findByRole('status')).toHaveTextContent(
      new RegExp(`Renovación registrada el ${dmy(hoy())}\\. Devenga S/\\s?88[.,]88 del ejercicio ${year + 1}\\.`)
    )
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ vigencia_hasta: `${year + 1}-12-31`, observacion: 'Renovación ficticia' })
  })

  it('shows the backend refusal inside the dialog', async () => {
    start('/anuncios/a1', [
      { path: '/srtm/anuncios/a1', body: ficha() },
      {
        method: 'POST',
        path: '/srtm/anuncios/a1/cese',
        status: 422,
        body: { title: 'Unprocessable Content', detail: 'La fecha es anterior a la autorización' }
      }
    ])
    await fichaEn()
    await userEvent.click(acto('Cesar'))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Fecha del acto'), { target: { value: `${year - 1}-01-01` } })
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Cierre ficticio')
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Cese ficticio')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cesar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La fecha es anterior a la autorización')
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ fecha: `${year - 1}-01-01`, motivo: 'Cierre ficticio', observacion: 'Cese ficticio' })
  })

  it('without CREATE on movimiento_anuncio every act is impeded, and says why', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha() }], { permisos: { admin: false, objects: { movimiento_anuncio: ['READ'] } } })
    await fichaEn()
    await waitFor(() => expect(acto('Renovar')).toBeDisabled())
    expect(acto('Cesar')).toBeDisabled()
    expect(acto('Retirar')).toBeDisabled()
    expect(screen.getByText('Sin permiso: renovar, cesar o retirar pide creación sobre los movimientos de anuncio.')).toBeInTheDocument()
  })
})

describe('tasas de anuncios', () => {
  it('lists each clase with its tasa and vigencia, and names the ones missing', async () => {
    start('/anuncios/tasas', [
      {
        path: '/srtm/anuncios/tasas',
        body: {
          anio: year,
          tasas: [{ clase: 'PANEL', tasa: 77.77, parametro_id: 'p-tasa', vigencia_desde: `${year}-01-01` }],
          faltan: [`TASA_ANUNCIO TOLDO ${year}`, `TASA_ANUNCIO LETRERO ${year}`]
        }
      }
    ])
    const t = await screen.findByRole('table', { name: `Tasas de anuncios ${year}` })
    const [, fila] = within(t).getAllByRole('row')
    const celdas = within(fila)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(celdas[0]).toBe('Panel')
    expect(celdas[1]).toMatch(/^S\/\s?77[.,]77$/)
    expect(celdas[2]).toBe(`01/01/${year}`)
    expect(screen.getByText(`Al año ${year} le falta:`).parentElement).toHaveTextContent(
      `TASA_ANUNCIO TOLDO ${year}; TASA_ANUNCIO LETRERO ${year}. Sin eso esas clases no se autorizan: nunca a 0.`
    )
    expect(t.textContent).not.toMatch(/0[.,]00/)
    expect(new URLSearchParams(lecturas('/srtm/anuncios/tasas')[0].path.split('?')[1]).get('anio')).toBe(String(year))
  })

  it("asks for next year's tasas too, to check them before they apply", async () => {
    start('/anuncios/tasas', [{ path: '/srtm/anuncios/tasas', body: { anio: year, tasas: [], faltan: [] } }])
    await screen.findByText(`Sin tasas de anuncios en ${year}`)
    const anio = screen.getByLabelText('Año')
    expect(within(anio).getAllByRole('option')[0]).toHaveValue(String(year + 1))
    fireEvent.change(anio, { target: { value: String(year + 1) } })
    await waitFor(() => expect(lecturas('/srtm/anuncios/tasas')).toHaveLength(2))
    expect(new URLSearchParams(lecturas('/srtm/anuncios/tasas')[1].path.split('?')[1]).get('anio')).toBe(String(year + 1))
  })
})

const fichaContribuyente = {
  contribuyente: { id: 'c1', codigo: '000001', nombre_completo: 'ANA FICTICIA', numero_documento: '12345678' },
  predios: 0,
  totales: { autoavaluo: 0, valor_afecto: 0 }
}
const fichaPredio = { predio: { id: 'p1', codigo: '01-01-0001', direccion: 'JR. FICTICIO 123' }, titulares: 1, totales: { autoavaluo: 0, valor_afecto: 0 } }
const anunciosDe = { al_dia: hoy(), anuncios: [{ ...anuncio(), estado: 'VENCIDO', vigencia_hasta_vigente: `${year + 1}-12-31` }] }

describe('pestaña Anuncios de las fichas', () => {
  it("lists the contribuyente's anuncios with the backend's estado at al_dia", async () => {
    start('/contribuyentes/c1?tab=anuncios', [
      { path: '/srtm/contribuyentes/c1/anuncios', body: anunciosDe },
      { path: '/srtm/contribuyentes/c1', body: fichaContribuyente }
    ])
    const t = await screen.findByRole('table', { name: `Anuncios al ${dmy(hoy())}` })
    expect(screen.getByRole('tab', { name: 'Anuncios' })).toHaveAttribute('aria-selected', 'true')
    const [, fila] = within(t).getAllByRole('row')
    expect(within(fila).getByRole('link', { name: `AN-${year}-000001` })).toHaveAttribute('href', '/anuncios/a1')
    // VENCIDO although the vigencia in force is still ahead: the backend's
    expect(within(fila).getAllByRole('cell').at(-1)).toHaveTextContent('Vencido')
    expect(screen.getByText(`Estado y vigencia al ${dmy(hoy())}.`)).toBeInTheDocument()
  })

  it.each([
    ['contribuyentes', 'c1', fichaContribuyente],
    ['predios', 'p1', fichaPredio]
  ] as const)('shows «—» as the vigencia of a cesado or retirado anuncio in the %s tab', async (de, id, cuerpo) => {
    start(`/${de}/${id}?tab=anuncios`, [
      {
        path: `/srtm/${de}/${id}/anuncios`,
        body: {
          al_dia: hoy(),
          anuncios: [
            { ...anuncio(), estado: 'CESADO', vigencia_hasta_vigente: `${year}-12-31` },
            { ...anuncio({ id: 'a2', numero: `AN-${year}-000002` }), estado: 'RETIRADO', vigencia_hasta_vigente: `${year}-12-31` }
          ]
        }
      },
      { path: `/srtm/${de}/${id}`, body: cuerpo }
    ])
    const t = await screen.findByRole('table', { name: `Anuncios al ${dmy(hoy())}` })
    expect(
      within(t)
        .getAllByRole('row')
        .slice(1)
        .map((r) =>
          within(r)
            .getAllByRole('cell')
            .slice(5)
            .map((c) => c.textContent)
        )
    ).toEqual([
      ['—', 'Cesado'],
      ['—', 'Retirado']
    ])
  })

  it('opens during the inscription once the fiscal domicilio is there (its step)', async () => {
    start('/contribuyentes/c1?tab=anuncios&inscripcion=1', [
      { path: '/srtm/contribuyentes/c1/anuncios', body: anunciosDe },
      { path: '/srtm/contribuyentes/c1/domicilios', body: [{ id: 'd1', tipo_domicilio: 'FISCAL', estado: 'ACTIVO' }] },
      { path: '/srtm/contribuyentes/c1', body: fichaContribuyente }
    ])
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Anuncios' })).toBeEnabled())
  })

  it("lists the predio's anuncios", async () => {
    start('/predios/p1?tab=anuncios', [
      { path: '/srtm/predios/p1/anuncios', body: { al_dia: hoy(), anuncios: [] } },
      { path: '/srtm/predios/p1', body: fichaPredio }
    ])
    expect(await screen.findByText('Ningún anuncio nombra este predio.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anuncios' })).toHaveAttribute('aria-selected', 'true')
    expect(lecturas('/srtm/predios/p1/anuncios')).toHaveLength(1)
  })
})

describe('anuncios en los dos temas', () => {
  it.each(['light', 'portal-tributario'])('shows the padrón and its estado with %s', async (theme) => {
    start('/anuncios', [{ path: '/srtm/anuncios', body: page([enPadron({ estado: 'CESADO' })]) }], { theme })
    const t = await screen.findByRole('table', { name: `Anuncios al ${dmy(hoy())}` })
    expect(within(t).getByText('Cesado')).toHaveAttribute('data-tono', 'ambar')
    expect(screen.getByRole('navigation', { name: 'Anuncios y propaganda' })).toBeInTheDocument()
  })

  it.each(['light', 'portal-tributario'])('shows the ficha and its acts with %s', async (theme) => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: cesado() }], { theme })
    await fichaEn()
    expect(screen.getByTestId('estado-anuncio')).toHaveTextContent('Cesado')
    expect(screen.getByText('Un anuncio cesado no se renueva.')).toBeInTheDocument()
  })
})

describe('EstadoAnuncioBadge', () => {
  it.each(['light', 'portal-tributario'])('names each estado from its own map with %s', (theme) => {
    localStorage.setItem('srtm.theme', theme)
    renderWithProviders(
      <>
        <EstadoAnuncioBadge estado="VIGENTE" />
        <EstadoAnuncioBadge estado="VENCIDO" />
        <EstadoAnuncioBadge estado="CESADO" />
        <EstadoAnuncioBadge estado="RETIRADO" />
      </>,
      { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null }
    )
    expect(screen.getByText('Vigente')).toHaveAttribute('data-tono', 'verde')
    expect(screen.getByText('Vencido')).toHaveAttribute('data-tono', 'rojo')
    expect(screen.getByText('Cesado')).toHaveAttribute('data-tono', 'ambar')
    expect(screen.getByText('Retirado')).toHaveAttribute('data-tono', '')
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument()
  })
})

describe('menú de anuncios', () => {
  it('the classic menu has one entry, current on the padrón and on a ficha, and the subnav links its pages', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha() }], { theme: 'light' })
    await fichaEn()
    const lateral = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(lateral).getByRole('link', { name: 'Anuncios' })).toHaveAttribute('aria-current', 'page')
    const subnav = screen.getByRole('navigation', { name: 'Anuncios y propaganda' })
    expect(
      within(subnav)
        .getAllByRole('link')
        .map((l) => [l.textContent, l.getAttribute('href')])
    ).toEqual([
      ['Padrón de anuncios', '/anuncios'],
      ['Nuevo anuncio', '/anuncios/nuevo'],
      ['Tasas de anuncios', '/anuncios/tasas']
    ])
  })

  // the bar shows the group short: Anuncios
  it('the menu bar has the group after Infracciones administrativas, marked with its leaf on a ficha', async () => {
    start('/anuncios/a1', [{ path: '/srtm/anuncios/a1', body: ficha() }], { theme: 'portal-tributario' })
    await fichaEn()
    const menu = screen.getByRole('navigation', { name: 'Secciones' })
    const grupos = within(menu)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => ['Infracciones', 'Anuncios', 'Emisión'].includes(t ?? ''))
    expect(grupos).toEqual(['Infracciones', 'Anuncios', 'Emisión'])
    const grupo = within(menu).getByRole('button', { name: 'Anuncios y propaganda' })
    expect(grupo).toHaveAttribute('aria-current', 'true')
    await userEvent.click(grupo)
    const panel = document.getElementById(grupo.getAttribute('aria-controls')!)!
    expect(within(panel).getByRole('link', { name: 'Padrón de anuncios' })).toHaveAttribute('aria-current', 'page')
  })
})
