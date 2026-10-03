import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { claves } from './queries'
import type { NotificacionPrevia, Pagina } from './types'

// las notificaciones previas (épica de infracciones administrativas, PR U2): el vencimiento y si está vencida a una
// fecha son del backend (una sola definición, nunca sumados en la pantalla), con esa fecha a la vista; el alta con su
// observación; la subsanación impedida con su porqué (subsanada, con acta, vencida, sin permiso) y el rechazo del
// backend dentro del diálogo. la hoja del menú en los dos menús. números, nombres y fechas FICTICIOS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dmy = (iso: string) => iso.split('-').reverse().join('/')

const base = (permisos: unknown = { admin: true, objects: {} }, theme = 'system'): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme, locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const notificacion = (valores: Partial<NotificacionPrevia> = {}): NotificacionPrevia => ({
  id: 'n1',
  numero: 'NP-0001',
  fecha: '2020-01-01',
  direccion: 'Jr. Ficticio 123',
  motivo: 'Motivo ficticio de prueba',
  plazo_dias: 5,
  observacion: 'Notificación ficticia',
  contribuyente: 'c1',
  predio: null,
  // the backend's: not fecha + 5 days on purpose, so a vencimiento computed on screen would show
  vencimiento: '2020-01-20',
  // and not vencida, though years have gone by: the backend says so
  vencida: false,
  vencidas_a: hoy(),
  subsanada: null,
  acta: null,
  contribuyente_nombre: 'CONTRIBUYENTE FICTICIO',
  ...valores
})

const pagina = (content: NotificacionPrevia[]): Pagina<NotificacionPrevia> => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

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

function start(routes: MockRoute[], { permisos, theme }: { permisos?: unknown; theme?: string } = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  if (theme) localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', '/infracciones/notificaciones')
  fetch = mockFetch([...routes, ...base(permisos, theme)])
  render(<PortalApp />)
}

const tabla = (al = hoy()) => screen.findByRole('table', { name: `Notificaciones previas, vencidas al ${dmy(al)}` })
const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/infracciones/notificaciones'))
const fila = (t: HTMLElement, numero: string) => within(t).getByRole('cell', { name: numero }).closest('tr')!
const celdas = (tr: HTMLElement) =>
  within(tr)
    .getAllByRole('cell')
    .map((c) => c.textContent)

describe('Notificaciones previas', () => {
  it('shows the backend vencimiento and vencida even when the dates suggest otherwise, with the day they hold at', async () => {
    const lista = pagina([
      notificacion(),
      notificacion({ id: 'n2', numero: 'NP-0002', fecha: hoy(), plazo_dias: 30, vencimiento: '2099-12-31', vencida: true }),
      notificacion({ id: 'n3', numero: 'NP-0003', plazo_dias: null, vencimiento: null, contribuyente: null, contribuyente_nombre: null }),
      notificacion({ id: 'n4', numero: 'NP-0004', subsanada: { fecha: '2020-01-03' }, acta: { id: 'a9', numero: 'ACTA-9' } })
    ])
    start([{ path: '/srtm/infracciones/notificaciones', body: lista }])
    const t = await tabla()
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Número', 'Fecha', 'Administrado', 'Dirección', 'Motivo', 'Plazo', 'Vencimiento', `Vencida al ${dmy(hoy())}`, 'Subsanada', 'Acta', 'Acciones'])

    // years after fecha + plazo, and not vencida: the backend's word, with its own vencimiento
    const vieja = celdas(fila(t, 'NP-0001'))
    expect(vieja.slice(0, 10)).toEqual([
      'NP-0001',
      '01/01/2020',
      'CONTRIBUYENTE FICTICIO',
      'Jr. Ficticio 123',
      'Motivo ficticio de prueba',
      '5 días',
      '20/01/2020',
      'No vencida',
      'No',
      '—'
    ])
    expect(within(fila(t, 'NP-0001')).getByRole('link', { name: 'CONTRIBUYENTE FICTICIO' })).toHaveAttribute('href', '/contribuyentes/c1')
    expect(t.textContent).not.toContain('06/01/2020')
    // served today with a long plazo, and vencida: the backend's word again
    expect(celdas(fila(t, 'NP-0002'))[7]).toBe('Vencida')
    // without a plazo nothing makes it vencida
    expect(celdas(fila(t, 'NP-0003')).slice(5, 8)).toEqual(['Sin plazo', 'No vence', 'Sin plazo'])
    // subsanada on its day, and the acta it led to opens its expediente
    const conActa = fila(t, 'NP-0004')
    expect(celdas(conActa)[8]).toBe('03/01/2020')
    expect(within(conActa).getByRole('link', { name: 'ACTA-9' })).toHaveAttribute('href', '/infracciones/a9')
    // asked at today by default
    expect(new URLSearchParams(lecturas()[0].path.split('?')[1]).get('vencidas_a')).toBe(hoy())
  })

  it('filters by número, contribuyente, dates and the day vencida holds at', async () => {
    start([
      { path: '/srtm/infracciones/notificaciones', body: pagina([notificacion({ vencidas_a: `${year}-02-15` })]) },
      {
        path: '/srtm/contribuyentes',
        body: { content: [{ id: 'c7', numero_documento: '00000007', nombre_completo: 'OTRO FICTICIO' }], page: 0, size: 8, totalElements: 1, totalPages: 1 }
      }
    ])
    await screen.findByRole('table')
    await userEvent.type(screen.getByLabelText('Número'), ' np-1 ')
    await userEvent.type(screen.getByLabelText('Contribuyente'), 'OTRO')
    await userEvent.click(await screen.findByRole('button', { name: '00000007 · OTRO FICTICIO' }))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: `${year}-01-01` } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: `${year}-01-31` } })
    fireEvent.change(screen.getByLabelText('Vencidas al'), { target: { value: `${year}-02-15` } })
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(lecturas()).toHaveLength(2))
    const params = new URLSearchParams(lecturas()[1].path.split('?')[1])
    expect(Object.fromEntries(params)).toEqual({
      numero: 'np-1',
      contribuyente: 'c7',
      desde: `${year}-01-01`,
      hasta: `${year}-01-31`,
      vencidas_a: `${year}-02-15`,
      page: '0',
      size: '20'
    })
    // the header carries the day the backend answered at
    expect(await tabla(`${year}-02-15`)).toBeInTheDocument()
  })

  it('keeps its queries under the infracciones keys', () => {
    expect(claves.notificaciones({ numero: 'NP', vencidas_a: `${year}-02-15` }, 2)).toEqual([
      'infracciones',
      'notificaciones',
      'NP',
      null,
      null,
      null,
      `${year}-02-15`,
      2,
      null
    ])
    // the partial search of the nueva acta's picker is a key of its own
    expect(claves.notificaciones({ q: 'np-00' }, 0).at(-1)).toBe('np-00')
  })

  it('registers one with its observación, the body as the backend takes it, and reads the list again', async () => {
    const creada = notificacion({ id: 'n9', numero: 'NP-0009', fecha: `${year}-03-01`, plazo_dias: 10, vencimiento: `${year}-03-15` })
    start([
      { method: 'POST', path: '/srtm/infracciones/notificaciones', status: 201, body: creada },
      { path: '/srtm/infracciones/notificaciones', body: pagina([notificacion()]) },
      {
        path: '/srtm/contribuyentes',
        body: { content: [{ id: 'c7', numero_documento: '00000007', nombre_completo: 'OTRO FICTICIO' }], page: 0, size: 8, totalElements: 1, totalPages: 1 }
      },
      {
        path: '/srtm/predios',
        body: { content: [{ id: 'p3', codigo: 'P-0003', direccion: 'Av. Ficticia 9' }], page: 0, size: 8, totalElements: 1, totalPages: 1 }
      }
    ])
    await tabla()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva notificación' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva notificación previa' })
    const registrar = within(dialogo).getByRole('button', { name: 'Registrar' })
    expect(within(dialogo).getByLabelText('Fecha')).toHaveValue(hoy())
    await userEvent.type(within(dialogo).getByLabelText('Número'), ' NP-0009 ')
    fireEvent.change(within(dialogo).getByLabelText('Fecha'), { target: { value: `${year}-03-01` } })
    await userEvent.type(within(dialogo).getByLabelText('Contribuyente'), 'OTRO')
    await userEvent.click(await within(dialogo).findByRole('button', { name: '00000007 · OTRO FICTICIO' }))
    await userEvent.type(within(dialogo).getByLabelText('Predio'), 'P-00')
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'P-0003 · Av. Ficticia 9' }))
    await userEvent.type(within(dialogo).getByLabelText('Dirección'), 'Av. Ficticia 9')
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Anuncio sin autorización')
    await userEvent.type(within(dialogo).getByLabelText('Plazo en días'), '10')
    // the observación is still missing
    expect(registrar).toBeDisabled()
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Operativo ficticio')
    const antes = lecturas().length
    await userEvent.click(registrar)

    expect(await within(dialogo).findByRole('status')).toHaveTextContent(`Notificación NP-0009 del 01/03/${year} registrada. Vence el 15/03/${year}.`)
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({
      numero: 'NP-0009',
      fecha: `${year}-03-01`,
      contribuyente: 'c7',
      predio: 'p3',
      direccion: 'Av. Ficticia 9',
      motivo: 'Anuncio sin autorización',
      plazo_dias: 10,
      observacion: 'Operativo ficticio'
    })
    await waitFor(() => expect(lecturas().length).toBeGreaterThan(antes))
  })

  it.each([
    [404, 'El contribuyente no existe'],
    [409, 'Ya existe la notificación NP-0001']
  ])('shows the backend %s inside the dialog', async (status, detail) => {
    start([
      { method: 'POST', path: '/srtm/infracciones/notificaciones', status, body: { title: 'Error', detail } },
      { path: '/srtm/infracciones/notificaciones', body: pagina([notificacion()]) }
    ])
    await tabla()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva notificación' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Número'), 'NP-0001')
    await userEvent.type(within(dialogo).getByLabelText('Dirección'), 'Jr. Ficticio 1')
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Motivo ficticio')
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Operativo ficticio')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(detail)
    // without a plazo the body says so, no 0
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ plazo_dias: null, contribuyente: null, predio: null })
  })

  it('shows the fields the backend refused (400)', async () => {
    start([
      {
        method: 'POST',
        path: '/srtm/infracciones/notificaciones',
        status: 400,
        body: { title: 'Bad Request', errors: [{ field: 'direccion', message: 'a lo más 300 caracteres' }] }
      },
      { path: '/srtm/infracciones/notificaciones', body: pagina([notificacion()]) }
    ])
    await tabla()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva notificación' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Número'), 'NP-0001')
    await userEvent.type(within(dialogo).getByLabelText('Dirección'), 'Jr. Ficticio 1')
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Motivo ficticio')
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Operativo ficticio')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('direccion: a lo más 300 caracteres')
  })
})

describe('Subsanación de una notificación previa', () => {
  const lista = pagina([
    notificacion(),
    notificacion({ id: 'n2', numero: 'NP-0002', subsanada: { fecha: '2020-01-03' } }),
    notificacion({ id: 'n3', numero: 'NP-0003', acta: { id: 'a9', numero: 'ACTA-9' } }),
    // vencida as the backend says, though its vencimiento is far ahead
    notificacion({ id: 'n4', numero: 'NP-0004', vencimiento: '2099-12-31', vencida: true })
  ])

  it('is impeded with why when the row says it cannot be', async () => {
    start([{ path: '/srtm/infracciones/notificaciones', body: lista }])
    const t = await tabla()
    expect(within(fila(t, 'NP-0001')).getByRole('button', { name: 'Subsanar NP-0001' })).toBeEnabled()
    const impedida = (numero: string, motivo: string) => {
      const tr = fila(t, numero)
      expect(within(tr).getByRole('button', { name: `Subsanar ${numero}` })).toBeDisabled()
      expect(within(tr).getByText(motivo)).toBeInTheDocument()
    }
    impedida('NP-0002', 'Ya se subsanó el 03/01/2020.')
    impedida('NP-0003', 'Ya originó el acta ACTA-9: no se subsana.')
    impedida('NP-0004', `Vencida al ${dmy(hoy())}: fuera de plazo.`)
  })

  it('without CREATE on subsanacion_notificacion it is impeded, and says why', async () => {
    start([{ path: '/srtm/infracciones/notificaciones', body: lista }], {
      permisos: { admin: false, objects: { notificacion_administrativa: ['READ', 'CREATE'], subsanacion_notificacion: ['READ'] } }
    })
    const t = await tabla()
    await waitFor(() => expect(within(fila(t, 'NP-0001')).getByRole('button', { name: 'Subsanar NP-0001' })).toBeDisabled())
    expect(within(fila(t, 'NP-0001')).getByText('Sin permiso: subsanar pide creación sobre las subsanaciones de notificación.')).toBeInTheDocument()
    // registering is still allowed
    expect(screen.getByRole('button', { name: 'Nueva notificación' })).toBeEnabled()
  })

  it('without CREATE on notificacion_administrativa registering is impeded, and says why', async () => {
    start([{ path: '/srtm/infracciones/notificaciones', body: lista }], { permisos: { admin: false, objects: { notificacion_administrativa: ['READ'] } } })
    await tabla()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva notificación' })).toBeDisabled())
    expect(screen.getByText('Sin permiso: registrar pide creación sobre las notificaciones administrativas.')).toBeInTheDocument()
  })

  it('posts the fecha and observación, and reads the list again', async () => {
    start([
      {
        method: 'POST',
        path: '/srtm/infracciones/notificaciones/n1/subsanacion',
        status: 201,
        body: { id: 's1', fecha: '2020-01-04', observacion: 'x', clave: 'n1', notificacion: 'n1' }
      },
      { path: '/srtm/infracciones/notificaciones', body: lista }
    ])
    const t = await tabla()
    await userEvent.click(within(fila(t, 'NP-0001')).getByRole('button', { name: 'Subsanar NP-0001' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Subsanar la notificación NP-0001' })
    expect(dialogo).toHaveTextContent('Notificada el 01/01/2020, vence el 20/01/2020.')
    fireEvent.change(within(dialogo).getByLabelText('Fecha de la subsanación'), { target: { value: '2020-01-04' } })
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Retiró el anuncio')
    const antes = lecturas().length
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Subsanar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ fecha: '2020-01-04', observacion: 'Retiró el anuncio' })
    await waitFor(() => expect(lecturas().length).toBeGreaterThan(antes))
  })

  it('without a fecha it sends none (today, the backend says), and shows its 422 detail', async () => {
    start([
      {
        method: 'POST',
        path: '/srtm/infracciones/notificaciones/n1/subsanacion',
        status: 422,
        body: { title: 'Unprocessable Content', detail: `La notificación NP-0001 venció el 20/01/2020: ya no se subsana` }
      },
      { path: '/srtm/infracciones/notificaciones', body: lista }
    ])
    const t = await tabla()
    await userEvent.click(within(fila(t, 'NP-0001')).getByRole('button', { name: 'Subsanar NP-0001' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Retiró el anuncio')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Subsanar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La notificación NP-0001 venció el 20/01/2020: ya no se subsana')
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ observacion: 'Retiró el anuncio' })
  })
})

describe('Notificaciones previas en los dos temas', () => {
  it.each(['light', 'portal-tributario'])('shows the same table and the backend vencida with %s', async (theme) => {
    start([{ path: '/srtm/infracciones/notificaciones', body: pagina([notificacion({ vencida: true })]) }], { theme })
    const t = await tabla()
    expect(celdas(fila(t, 'NP-0001'))[7]).toBe('Vencida')
    const subnav = screen.getByRole('navigation', { name: 'Infracciones administrativas' })
    expect(within(subnav).getByRole('link', { name: 'Notificaciones previas' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('menú de las notificaciones previas', () => {
  it('the tree menu has the leaf before the CUIS, current on its page', async () => {
    start([{ path: '/srtm/infracciones/notificaciones', body: pagina([notificacion()]) }], { theme: 'portal-tributario' })
    await tabla()
    const lateral = screen.getByRole('navigation', { name: 'Secciones' })
    const hojas = within(lateral)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(hojas.indexOf('Notificaciones previas')).toBe(hojas.indexOf('CUIS') - 1)
    expect(within(lateral).getByRole('link', { name: 'Notificaciones previas' })).toHaveAttribute('aria-current', 'page')
  })

  it('the subnav links the notificaciones before the CUIS', async () => {
    start([{ path: '/srtm/infracciones/notificaciones', body: pagina([notificacion()]) }], { theme: 'light' })
    await tabla()
    const subnav = screen.getByRole('navigation', { name: 'Infracciones administrativas' })
    expect(
      within(subnav)
        .getAllByRole('link')
        .map((l) => [l.textContent, l.getAttribute('href')])
    ).toEqual([
      ['Expedientes', '/infracciones'],
      ['Nueva acta', '/infracciones/nueva'],
      ['Notificaciones previas', '/infracciones/notificaciones'],
      ['CUIS', '/infracciones/cuis'],
      ['Escalas y plazos', '/infracciones/plazos']
    ])
  })
})
