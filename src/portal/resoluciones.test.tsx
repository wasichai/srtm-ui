import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { CodigoInfraccion, DescargoPapeleta, ExpedienteInfraccion, NotificacionResolucion, Papeleta, ResolucionGerencia } from './types'

// descargos, resoluciones y su notificación (épica de infracciones administrativas, PR U4): en la ficha del expediente
// se registra un descargo y se ve su plazo y si se presentó en él tal como lo dice el backend (nunca contado aquí); se
// dicta la RIS o la resolución de un recurso (que exige el descargo que resuelve, su sentido y su efecto; SE_REDUCE se
// ofrece impedido y dice por qué); el PDF de cada resolución; cada intento de notificación con su exigible_desde del
// backend o «no surte efecto». lo que falta para computar un plazo, en una Alerta; cada acción impedida dice por qué
// (el orden legal del backend o el permiso). números, nombres y fechas FICTICIOS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const base = (permisos: unknown = { admin: true, objects: {} }, theme = 'system'): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme, locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const codigo: CodigoInfraccion = {
  id: 'k1',
  familia: 'ADMINISTRATIVA',
  codigo: 'X-001',
  descripcion: 'Infracción ficticia de prueba',
  materia: null,
  porcentaje_uit: 10,
  porcentaje_uit_segunda: null,
  porcentaje_uit_tercera: null,
  medida_complementaria: null,
  base_legal: 'Ordenanza ficticia 000',
  vigencia_desde: `${year}-01-01`,
  vigencia_hasta: null,
  observacion: 'Carga ficticia',
  clave: `ADMINISTRATIVA|X-001|${year}-01-01`,
  clave_vigente: 'ADMINISTRATIVA|X-001'
}

const papeleta: Papeleta = {
  id: 'a1',
  familia: 'ADMINISTRATIVA',
  numero: 'ACTA-0001',
  clave: 'ADMINISTRATIVA|ACTA-0001',
  fecha_infraccion: `${year}-02-10`,
  hora_infraccion: null,
  lugar: 'Jr. Ficticio 123',
  expediente: null,
  inspector: null,
  descripcion_hecho: null,
  reincidencia: 'PRIMERA',
  medida_complementaria: null,
  base_imponible: 1000,
  porcentaje_infraccion: 10,
  importe_infraccion: 111.11,
  porcentaje_a_cobrar: 10,
  importe_a_pagar: 111.11,
  importe_con_beneficio: null,
  fecha_calculo: `${year}-02-10`,
  observacion: 'Acta ficticia',
  codigo_infraccion: 'k1',
  uit: 'p-uit',
  obligado: 'c1',
  contribuyente: 'c1',
  predio: null,
  notificacion_previa: null
}

const descargo = (valores: Partial<DescargoPapeleta> = {}): DescargoPapeleta => ({
  id: 'd1',
  numero_expediente: 'EXP-D-1',
  tipo_recurso: 'DESCARGO',
  fecha: `${year}-02-12`,
  presentado_hasta: `${year}-02-17`,
  en_plazo: true,
  plazo_texto: '5 DIAS_HABILES',
  sustento: 'Sustento ficticio',
  observacion: 'Descargo ficticio',
  papeleta: 'a1',
  plazo: 'p-plazo',
  ...valores
})

const resolucion = (valores: Partial<ResolucionGerencia> = {}): ResolucionGerencia => ({
  id: 'r1',
  tipo: 'ADMINISTRATIVA',
  anio: year,
  correlativo: 1,
  numero: `RIS-${year}-000001`,
  fecha: `${year}-03-02`,
  sentido: null,
  efecto: null,
  sancion_accesoria: 'Clausura ficticia',
  sustento: 'Sustento ficticio',
  plazo_texto: '15 DIAS_HABILES',
  clave_ris: 'a1',
  clave_descargo: null,
  observacion: 'Resolución ficticia',
  papeleta: 'a1',
  descargo: null,
  plazo: 'p-rg',
  ...valores
})

const notificacion = (valores: Partial<NotificacionResolucion> = {}): NotificacionResolucion => ({
  id: 'nr1',
  intento: 1,
  clave: 'r1|1',
  fecha_diligencia: `${year}-03-05`,
  modalidad: 'PERSONAL',
  resultado: 'NOTIFICADO',
  notificador: 'NOTIFICADOR FICTICIO',
  direccion: 'Jr. Ficticio 123',
  receptor: 'RECEPTOR FICTICIO',
  documento_receptor: '00000009',
  vinculo: 'Hermano',
  acuse: null,
  // the backend's: no count of días hábiles from 05/03 lands on 01/01 of the next year, so a date computed here would show
  exigible_desde: `${year + 1}-01-01`,
  plazo_texto: '15 DIAS_HABILES',
  observacion: 'Notificación ficticia',
  resolucion: 'r1',
  plazo: 'p-rg',
  ...valores
})

const expediente = (valores: Partial<ExpedienteInfraccion> = {}): ExpedienteInfraccion => ({
  acta: papeleta,
  referencia: 'PAPELETA-a1',
  codigo_infraccion: codigo,
  notificacion_previa: null,
  actos: [{ orden: 1, acto: 'Acta de constatación', fecha: `${year}-02-10`, documento: 'ACTA-0001', id: 'a1', detalle: null }],
  descargos: [],
  resoluciones: [],
  anulacion: null,
  fase: 'CONSTATADA',
  fase_al_dia: hoy(),
  estado_de_la_deuda: 'PENDIENTE',
  acciones: {
    descargo: { permitida: true, motivo: null },
    resolucion: { permitida: true, motivo: null },
    anulacion: { permitida: true, motivo: null }
  },
  ...valores
})

// an expediente with a descargo resolved by an RGR, and the RIS notified twice: once not found, once notified
const completo = () =>
  expediente({
    descargos: [descargo({ en_plazo: false })],
    resoluciones: [
      {
        ...resolucion(),
        notificaciones: [
          notificacion({ id: 'nr0', intento: 1, clave: 'r1|1', resultado: 'NO_UBICADO', exigible_desde: null, plazo_texto: null, plazo: null }),
          notificacion({ id: 'nr1', intento: 2, clave: 'r1|2' })
        ]
      },
      {
        ...resolucion({
          id: 'r2',
          tipo: 'RECURSO',
          numero: `RGR-${year}-000001`,
          fecha: `${year}-03-20`,
          sentido: 'INFUNDADO',
          efecto: 'SE_MANTIENE',
          sancion_accesoria: null,
          clave_ris: null,
          clave_descargo: 'd1',
          descargo: 'd1'
        }),
        notificaciones: []
      }
    ]
  })

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // jsdom has no object urls
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  delete document.documentElement.dataset.theme
})

function start(routes: MockRoute[], { permisos, theme }: { permisos?: unknown; theme?: string } = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  if (theme) localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', '/infracciones/a1')
  fetch = mockFetch([...routes, ...base(permisos, theme)])
  render(<PortalApp />)
}

const ficha = () => screen.findByRole('table', { name: 'Actos del expediente' })
const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path === '/srtm/infracciones/actas/a1').length
const posted = (path: string) =>
  waitFor(() => {
    const call = fetch!.calls.find((c) => c.method === 'POST' && c.path === path)
    expect(call).toBeDefined()
    return call!
  })
const celdas = (tr: HTMLElement) =>
  within(tr)
    .getAllByRole('cell')
    .map((c) => c.textContent)
const observar = (dialogo: HTMLElement, texto = 'Registro ficticio') =>
  fireEvent.change(within(dialogo).getByLabelText('Observación'), { target: { value: texto } })

describe('Descargos', () => {
  const DESCARGOS = '/srtm/infracciones/actas/a1/descargos'

  async function llenar() {
    await ficha()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar descargo' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar un descargo del acta ACTA-0001' })
    fireEvent.change(within(dialogo).getByLabelText(/^Número de expediente/), { target: { value: ' EXP-D-9 ' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Tipo de recurso/), { target: { value: 'RECONSIDERACION' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Fecha de presentación/), { target: { value: `${year}-02-12` } })
    fireEvent.change(within(dialogo).getByLabelText(/^Sustento/), { target: { value: 'Sustento ficticio' } })
    observar(dialogo)
    return dialogo
  }

  it('shows the plazo and whether it was met as the backend says, even when the dates suggest otherwise', async () => {
    start([
      {
        method: 'POST',
        path: DESCARGOS,
        status: 201,
        // presented before presentado_hasta, and still out of plazo: the backend's word, never compared here
        body: descargo({ id: 'd9', numero_expediente: 'EXP-D-9', tipo_recurso: 'RECONSIDERACION', presentado_hasta: `${year}-02-20`, en_plazo: false })
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    const dialogo = await llenar()
    const antes = lecturas()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByText('Descargo EXP-D-9 registrado.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('status')).toHaveTextContent(
      `Presentado el 12/02/${year}; plazo 5 DIAS_HABILES, hasta el 20/02/${year}. Fuera de plazo: se registra igual y se resuelve improcedente.`
    )
    expect((await posted(DESCARGOS)).body).toEqual({
      numero_expediente: 'EXP-D-9',
      tipo_recurso: 'RECONSIDERACION',
      fecha: `${year}-02-12`,
      sustento: 'Sustento ficticio',
      observacion: 'Registro ficticio'
    })
    await waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
    // the dialog's own Cerrar, not its corner's
    await userEvent.click(within(dialogo).getByText('Cerrar', { selector: 'button' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says it was presented in plazo when the backend says so, even after presentado_hasta', async () => {
    start([
      {
        method: 'POST',
        path: DESCARGOS,
        status: 201,
        body: descargo({ id: 'd9', numero_expediente: 'EXP-D-9', fecha: `${year}-02-25`, presentado_hasta: `${year}-02-17`, en_plazo: true })
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    const dialogo = await llenar()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByRole('status')).toHaveTextContent('Presentado dentro del plazo.')
  })

  it('names in an Alerta what the backend lacks to compute the plazo (422 faltan)', async () => {
    start([
      {
        method: 'POST',
        path: DESCARGOS,
        status: 422,
        body: { title: 'Unprocessable Content', detail: 'No se puede computar el plazo', faltan: [`PLAZO DESCARGO_PAPELETA ${year}`, `FERIADOS ${year}`] }
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    const dialogo = await llenar()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      `No se puede computar el plazo Falta: PLAZO DESCARGO_PAPELETA ${year}; FERIADOS ${year}.`
    )
    // the form stays, to send again
    expect(within(dialogo).getByRole('button', { name: 'Registrar' })).toBeEnabled()
  })

  it('impedes it with the reason the backend gives', async () => {
    start([
      {
        path: '/srtm/infracciones/actas/a1',
        body: expediente({
          acciones: {
            descargo: { permitida: false, motivo: 'Acta anulada: no admite descargos.' },
            resolucion: { permitida: true, motivo: null },
            anulacion: { permitida: true, motivo: null }
          }
        })
      }
    ])
    await ficha()
    expect(screen.getByRole('button', { name: 'Registrar descargo' })).toBeDisabled()
    expect(screen.getByText('Acta anulada: no admite descargos.')).toBeInTheDocument()
  })

  it('without CREATE on descargo_papeleta it is impeded, and says why', async () => {
    start([{ path: '/srtm/infracciones/actas/a1', body: expediente() }], {
      permisos: { admin: false, objects: { papeleta: ['READ'], descargo_papeleta: ['READ'], resolucion_gerencia: ['CREATE'] } }
    })
    await ficha()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar descargo' })).toBeDisabled())
    expect(screen.getByText('Sin permiso: registrar un descargo pide creación sobre los descargos de papeleta.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dictar resolución' })).toBeEnabled()
  })
})

describe('Resoluciones', () => {
  const RESOLUCIONES = '/srtm/infracciones/actas/a1/resoluciones'
  const pdfs = () => fetch!.calls.map((c) => c.path).filter((p) => p.endsWith('/pdf'))

  async function abrir() {
    await ficha()
    await userEvent.click(screen.getByRole('button', { name: 'Dictar resolución' }))
    return screen.findByRole('dialog', { name: 'Dictar una resolución del acta ACTA-0001' })
  }

  it('dicta the RIS without a descargo nor a fallo, shows its número and opens its PDF', async () => {
    start([
      { method: 'POST', path: RESOLUCIONES, status: 201, body: resolucion({ id: 'r9', numero: `RIS-${year}-000009` }) },
      { path: '/srtm/infracciones/resoluciones/r9/pdf', body: null },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    const dialogo = await abrir()
    expect(within(dialogo).getByLabelText(/^Tipo/)).toHaveValue('ADMINISTRATIVA')
    expect(within(dialogo).queryByLabelText(/^Descargo que resuelve/)).not.toBeInTheDocument()
    fireEvent.change(within(dialogo).getByLabelText(/^Sustento/), { target: { value: ' Sustento ficticio ' } })
    fireEvent.change(within(dialogo).getByLabelText('Sanción accesoria'), { target: { value: 'Clausura ficticia' } })
    observar(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Dictar' }))
    expect(await within(dialogo).findByText(`Resolución RIS-${year}-000009 dictada el 02/03/${year}.`)).toBeInTheDocument()
    // no fecha when blank: the backend takes today
    expect((await posted(RESOLUCIONES)).body).toEqual({
      tipo: 'ADMINISTRATIVA',
      descargo: null,
      sentido: null,
      efecto: null,
      sustento: 'Sustento ficticio',
      sancion_accesoria: 'Clausura ficticia',
      observacion: 'Registro ficticio'
    })

    await userEvent.click(within(dialogo).getByRole('button', { name: `Ver PDF de RIS-${year}-000009` }))
    expect(await screen.findByTitle(`Resolución RIS-${year}-000009`)).toHaveAttribute('src', 'blob:pdf')
    expect(pdfs()).toEqual(['/srtm/infracciones/resoluciones/r9/pdf'])
  })

  it('a RECURSO asks for the descargo it resolves, its sentido and its efecto; SE_REDUCE is offered impeded with why', async () => {
    start([
      {
        method: 'POST',
        path: RESOLUCIONES,
        status: 201,
        body: resolucion({ id: 'r9', tipo: 'RECURSO', numero: `RGR-${year}-000009`, descargo: 'd1', sentido: 'FUNDADO', efecto: 'SE_DEJA_SIN_EFECTO' })
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente({ descargos: [descargo()] }) }
    ])
    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByLabelText(/^Tipo/), { target: { value: 'RECURSO' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Sustento/), { target: { value: 'Sustento ficticio' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Fecha de la resolución/), { target: { value: `${year}-03-02` } })
    observar(dialogo)
    const dictar = within(dialogo).getByRole('button', { name: 'Dictar' })
    expect(dictar).toBeDisabled()
    expect(within(dialogo).getByText('Para dictar falta: el descargo que resuelve, el sentido del fallo, el efecto sobre la multa.')).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Sanción accesoria')).not.toBeInTheDocument()

    const reduce = within(dialogo).getByRole('option', { name: 'Se reduce la multa (no disponible)' })
    expect(reduce).toBeDisabled()
    expect(within(dialogo).getByTestId('sin-reduccion')).toHaveTextContent('Se reduce la multa: No hay regla de reducción: la fija la ordenanza (D-02b).')

    fireEvent.change(within(dialogo).getByLabelText(/^Descargo que resuelve/), { target: { value: 'd1' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Sentido del fallo/), { target: { value: 'FUNDADO' } })
    expect(dictar).toBeDisabled()
    fireEvent.change(within(dialogo).getByLabelText(/^Efecto sobre la multa/), { target: { value: 'SE_DEJA_SIN_EFECTO' } })
    expect(dictar).toBeEnabled()
    await userEvent.click(dictar)
    expect(await within(dialogo).findByText(`Resolución RGR-${year}-000009 dictada el 02/03/${year}.`)).toBeInTheDocument()
    expect((await posted(RESOLUCIONES)).body).toEqual({
      tipo: 'RECURSO',
      descargo: 'd1',
      sentido: 'FUNDADO',
      efecto: 'SE_DEJA_SIN_EFECTO',
      fecha: `${year}-03-02`,
      sustento: 'Sustento ficticio',
      sancion_accesoria: null,
      observacion: 'Registro ficticio'
    })
  })

  it('a RECURSO on an acta without descargos says it resolves one, and cannot be sent', async () => {
    start([{ path: '/srtm/infracciones/actas/a1', body: expediente() }])
    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByLabelText(/^Tipo/), { target: { value: 'RECURSO' } })
    expect(within(dialogo).getByText('El acta no tiene descargos: una resolución de recurso resuelve un descargo.')).toBeInTheDocument()
    fireEvent.change(within(dialogo).getByLabelText(/^Sustento/), { target: { value: 'Sustento ficticio' } })
    observar(dialogo)
    expect(within(dialogo).getByRole('button', { name: 'Dictar' })).toBeDisabled()
  })

  it.each([
    [
      422,
      { title: 'Unprocessable Content', detail: 'No se puede computar el plazo del recurso', faltan: [`PLAZO RG_RECURSO ${year}`] },
      `Falta: PLAZO RG_RECURSO ${year}.`
    ],
    [409, { title: 'Conflict', detail: 'El acta ya tiene su RIS' }, 'El acta ya tiene su RIS'],
    [422, { title: 'Unprocessable Content', detail: 'No hay regla de reducción: la fija la ordenanza (D-02b)' }, 'No hay regla de reducción']
  ])('shows the backend refusal %i inside the dialog', async (status, body, texto) => {
    start([
      { method: 'POST', path: RESOLUCIONES, status, body },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByLabelText(/^Sustento/), { target: { value: 'Sustento ficticio' } })
    observar(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Dictar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(texto)
  })

  it('impedes it with the reason the backend gives', async () => {
    start([
      {
        path: '/srtm/infracciones/actas/a1',
        body: expediente({
          acciones: {
            descargo: { permitida: true, motivo: null },
            resolucion: { permitida: false, motivo: 'Dejada sin efecto: no queda nada que resolver.' },
            anulacion: { permitida: true, motivo: null }
          }
        })
      }
    ])
    await ficha()
    expect(screen.getByRole('button', { name: 'Dictar resolución' })).toBeDisabled()
    expect(screen.getByText('Dejada sin efecto: no queda nada que resolver.')).toBeInTheDocument()
  })

  it('without CREATE on resolucion_gerencia it is impeded, and says why', async () => {
    start([{ path: '/srtm/infracciones/actas/a1', body: expediente() }], {
      permisos: { admin: false, objects: { papeleta: ['READ'], resolucion_gerencia: ['READ'] } }
    })
    await ficha()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dictar resolución' })).toBeDisabled())
    expect(screen.getByText('Sin permiso: dictar una resolución pide creación sobre las resoluciones de gerencia.')).toBeInTheDocument()
  })
})

describe('Descargos y resoluciones en la ficha', () => {
  it('lists the descargos with their dates and plazo as the backend says, and the resolución that resolved each', async () => {
    start([{ path: '/srtm/infracciones/actas/a1', body: completo() }])
    await ficha()
    const t = screen.getByRole('table', { name: 'Descargos' })
    expect(
      within(t)
        .getAllByRole('row')
        .slice(1)
        .map((r) => celdas(r))
    ).toEqual([
      // presented before presentado_hasta and still out of plazo: the backend's word
      ['EXP-D-1', 'Descargo', `12/02/${year}`, '5 DIAS_HABILES', `17/02/${year}`, 'Fuera de plazo', 'Sustento ficticio', `RGR-${year}-000001`]
    ])
  })

  it('lists the resoluciones with their fallo and plazo, and each notificación with its exigible_desde or that it has no effect', async () => {
    start([{ path: '/srtm/infracciones/actas/a1', body: completo() }])
    await ficha()
    const t = screen.getByRole('table', { name: 'Resoluciones' })
    const filas = within(t).getAllByRole('row').slice(1)
    expect(celdas(filas[0]).slice(0, 8)).toEqual([
      `RIS-${year}-000001`,
      'Administrativa (RIS)',
      `02/03/${year}`,
      '—',
      '—',
      'Clausura ficticia',
      '15 DIAS_HABILES',
      '2 intentos'
    ])
    expect(celdas(filas[1]).slice(0, 8)).toEqual([
      `RGR-${year}-000001`,
      'De recurso (RGR)',
      `20/03/${year}`,
      'EXP-D-1',
      'Infundado · Se mantiene la multa',
      '—',
      '15 DIAS_HABILES',
      'Sin notificar'
    ])
    const n = screen.getByRole('table', { name: 'Notificaciones de las resoluciones' })
    expect(
      within(n)
        .getAllByRole('row')
        .slice(1)
        .map((r) => celdas(r))
    ).toEqual([
      [`RIS-${year}-000001`, '1', `05/03/${year}`, 'Personal', 'No ubicado', 'Jr. Ficticio 123', 'RECEPTOR FICTICIO · 00000009 · Hermano', 'No surte efecto'],
      [
        `RIS-${year}-000001`,
        '2',
        `05/03/${year}`,
        'Personal',
        'Notificado',
        'Jr. Ficticio 123',
        'RECEPTOR FICTICIO · 00000009 · Hermano',
        `01/01/${year + 1} (15 DIAS_HABILES)`
      ]
    ])
  })

  it("opens a resolución's PDF from its row with its path", async () => {
    start([
      { path: '/srtm/infracciones/resoluciones/r2/pdf', body: null },
      { path: '/srtm/infracciones/actas/a1', body: completo() }
    ])
    await ficha()
    await userEvent.click(screen.getByRole('button', { name: `Ver PDF de RGR-${year}-000001` }))
    const dialogo = await screen.findByRole('dialog', { name: `Resolución RGR-${year}-000001` })
    expect(await within(dialogo).findByTitle(`Resolución RGR-${year}-000001`)).toHaveAttribute('src', 'blob:pdf')
    expect(fetch!.calls.map((c) => c.path).filter((p) => p.endsWith('/pdf'))).toEqual(['/srtm/infracciones/resoluciones/r2/pdf'])
  })
})

describe('Notificación de una resolución', () => {
  const NOTIFICACION = '/srtm/infracciones/resoluciones/r1/notificacion'

  async function llenar() {
    await ficha()
    await userEvent.click(screen.getByRole('button', { name: `Notificar RIS-${year}-000001` }))
    const dialogo = await screen.findByRole('dialog', { name: `Notificar la resolución RIS-${year}-000001` })
    expect(within(dialogo).getByText('Si la deja vacía, se usa el domicilio fiscal vigente a la fecha de la diligencia.')).toBeInTheDocument()
    fireEvent.change(within(dialogo).getByLabelText(/^Notificador/), { target: { value: ' NOTIFICADOR FICTICIO ' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Resultado/), { target: { value: 'NO_UBICADO' } })
    observar(dialogo)
    return dialogo
  }

  it('without effect says so, with the direccion the backend used, and sends no fecha nor direccion when blank', async () => {
    start([
      {
        method: 'POST',
        path: NOTIFICACION,
        status: 201,
        body: notificacion({
          id: 'nr9',
          intento: 3,
          fecha_diligencia: hoy(),
          resultado: 'NO_UBICADO',
          direccion: 'Domicilio fiscal ficticio 456',
          exigible_desde: null,
          plazo_texto: null,
          plazo: null
        })
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente({ resoluciones: [{ ...resolucion(), notificaciones: [] }] }) }
    ])
    const dialogo = await llenar()
    const antes = lecturas()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByText('Intento 3 registrado.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('status')).toHaveTextContent(
      `Diligencia del ${hoy().split('-').reverse().join('/')} en Domicilio fiscal ficticio 456: no ubicado. No surte efecto: no ubicado.`
    )
    expect((await posted(NOTIFICACION)).body).toEqual({
      modalidad: 'PERSONAL',
      resultado: 'NO_UBICADO',
      notificador: 'NOTIFICADOR FICTICIO',
      direccion: null,
      receptor: null,
      documento_receptor: null,
      vinculo: null,
      acuse: null,
      observacion: 'Registro ficticio'
    })
    await waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
  })

  it('shows the exigible_desde the backend computed, whatever the dates suggest', async () => {
    start([
      { method: 'POST', path: NOTIFICACION, status: 201, body: notificacion({ intento: 1, resultado: 'RECHAZADO' }) },
      { path: '/srtm/infracciones/actas/a1', body: expediente({ resoluciones: [{ ...resolucion(), notificaciones: [] }] }) }
    ])
    const dialogo = await llenar()
    fireEvent.change(within(dialogo).getByLabelText(/^Resultado/), { target: { value: 'RECHAZADO' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Fecha de la diligencia/), { target: { value: `${year}-03-05` } })
    fireEvent.change(within(dialogo).getByLabelText('Dirección'), { target: { value: 'Jr. Ficticio 123' } })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByRole('status')).toHaveTextContent(
      `Diligencia del 05/03/${year} en Jr. Ficticio 123: rechazado. Exigible desde el 01/01/${year + 1} (plazo 15 DIAS_HABILES).`
    )
    expect((await posted(NOTIFICACION)).body).toMatchObject({ fecha_diligencia: `${year}-03-05`, resultado: 'RECHAZADO', direccion: 'Jr. Ficticio 123' })
  })

  it('names in an Alerta what the backend lacks to compute exigible_desde (422 faltan)', async () => {
    start([
      {
        method: 'POST',
        path: NOTIFICACION,
        status: 422,
        body: {
          title: 'Unprocessable Content',
          detail: 'No se puede computar desde cuándo es exigible',
          faltan: [`PLAZO RG_RECURSO ${year}`, `FERIADOS ${year}`]
        }
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente({ resoluciones: [{ ...resolucion(), notificaciones: [] }] }) }
    ])
    const dialogo = await llenar()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(`Falta: PLAZO RG_RECURSO ${year}; FERIADOS ${year}.`)
  })

  it('without CREATE on notificacion_resolucion it is impeded, and says why', async () => {
    start([{ path: '/srtm/infracciones/actas/a1', body: completo() }], {
      permisos: { admin: false, objects: { papeleta: ['READ'], resolucion_gerencia: ['READ'], notificacion_resolucion: ['READ'] } }
    })
    await ficha()
    await waitFor(() => expect(screen.getByRole('button', { name: `Notificar RIS-${year}-000001` })).toBeDisabled())
    expect(screen.getByRole('button', { name: `Notificar RGR-${year}-000001` })).toBeDisabled()
    expect(screen.getByText('Sin permiso: notificar pide creación sobre las notificaciones de resolución.')).toBeInTheDocument()
    // the PDF is only read
    expect(screen.getByRole('button', { name: `Ver PDF de RIS-${year}-000001` })).toBeEnabled()
  })
})

describe('Descargos y resoluciones en los dos temas', () => {
  it.each(['light', 'portal-tributario'])('shows the acts, the backend plazos and the impeded reasons with %s', async (theme) => {
    start(
      [
        {
          path: '/srtm/infracciones/actas/a1',
          body: {
            ...completo(),
            acciones: {
              descargo: { permitida: false, motivo: 'Fuera del procedimiento: motivo ficticio del backend.' },
              resolucion: { permitida: true, motivo: null },
              anulacion: { permitida: true, motivo: null }
            }
          }
        }
      ],
      { theme }
    )
    await ficha()
    expect(screen.getByRole('button', { name: 'Registrar descargo' })).toBeDisabled()
    expect(screen.getByText('Fuera del procedimiento: motivo ficticio del backend.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dictar resolución' })).toBeEnabled()
    expect(within(screen.getByRole('table', { name: 'Descargos' })).getByText('Fuera de plazo')).toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { name: 'Notificaciones de las resoluciones' })).getByText(`01/01/${year + 1} (15 DIAS_HABILES)`)
    ).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Notificaciones de las resoluciones' })).getByText('No surte efecto')).toBeInTheDocument()
  })
})
