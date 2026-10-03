import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { TABS_KEY } from './auth/session'
import { PortalApp } from './PortalApp'
import { claves } from './queries'
import type { ActaCreada, CatalogoCuis, Cuis, ExpedienteInfraccion, NotificacionPrevia, Pagina, Papeleta, Procedimiento } from './types'

// las actas y sus expedientes (épica de infracciones administrativas, PR U3): la grilla de expedientes con la fase y el
// estado de la deuda en dos columnas con sus nombres (y la fase a su fecha); la nueva acta con el CUIS vigente el día de
// la infracción, el obligado elegido (nunca deducido), el contribuyente o el predio, y el desglose que cifra el backend
// con su fecha (nunca base × % en la pantalla); lo que falta para cifrar, en una Alerta; la ficha con su acta, el CUIS
// aplicado y los actos en el orden legal que manda el backend; la anulación impedida con el motivo del backend o por
// permiso. los menús. números, nombres, UIT y multas FICTICIOS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dmy = (iso: string) => iso.split('-').reverse().join('/')
// money as the portal writes it, whatever the runtime's ICU spaces it with
const soles = (texto: string | null | undefined) => (texto ?? '').replace(/\s/g, ' ')

const base = (permisos: unknown = { admin: true, objects: {} }, theme = 'system'): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme, locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const procedimiento = (valores: Partial<Procedimiento> = {}): Procedimiento => ({
  id: 'a1',
  numero: 'ACTA-0001',
  fecha_infraccion: `${year}-02-10`,
  administrado: 'ADMINISTRADO FICTICIO',
  documento: '00000001',
  codigo: 'X-001',
  descripcion_infraccion: 'Infracción ficticia de prueba',
  porcentaje_infraccion: 10,
  // the backend's: not 10 % of any UIT on purpose, so an amount computed on screen would show
  importe_a_pagar: 987.65,
  fecha_calculo: `${year}-02-11`,
  medida_complementaria: 'Clausura ficticia',
  fase: 'PREVENTIVA',
  fase_al_dia: hoy(),
  estado_de_la_deuda: 'PENDIENTE',
  ...valores
})

const pagina = <T,>(content: T[]): Pagina<T> => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const cuis = (valores: Partial<Cuis> = {}): Cuis => ({
  id: 'k1',
  familia: 'ADMINISTRATIVA',
  codigo: 'X-001',
  descripcion: 'Infracción ficticia de prueba',
  materia: null,
  porcentaje_uit: 10,
  porcentaje_uit_segunda: 20,
  porcentaje_uit_tercera: null,
  medida_complementaria: 'Clausura ficticia',
  base_legal: 'Ordenanza ficticia 000',
  vigencia_desde: `${year}-01-01`,
  vigencia_hasta: null,
  observacion: 'Carga ficticia',
  clave: `ADMINISTRATIVA|X-001|${year}-01-01`,
  clave_vigente: 'ADMINISTRATIVA|X-001',
  multa: 100,
  multa_segunda: 200,
  multa_tercera: null,
  ...valores
})

const catalogo = (valores: Partial<CatalogoCuis> = {}): CatalogoCuis => ({
  vigentes_a: hoy(),
  uit: { valor: 1000, anio: year, parametro_id: 'p-uit' },
  faltan: [],
  codigos: [cuis()],
  ...valores
})

const papeleta = (valores: Partial<Papeleta> = {}): Papeleta => ({
  id: 'a1',
  familia: 'ADMINISTRATIVA',
  numero: 'ACTA-0001',
  clave: 'ADMINISTRATIVA|ACTA-0001',
  fecha_infraccion: `${year}-02-10`,
  hora_infraccion: '10:30',
  lugar: 'Jr. Ficticio 123',
  expediente: 'EXP-0001',
  inspector: 'INSPECTOR FICTICIO',
  descripcion_hecho: 'Hecho ficticio de prueba',
  reincidencia: 'SEGUNDA',
  medida_complementaria: 'Clausura ficticia',
  base_imponible: 1000,
  porcentaje_infraccion: 10,
  // not 1000 × 10 %, nor 1000 × 20 %: the backend's, frozen
  importe_infraccion: 111.11,
  porcentaje_a_cobrar: 20,
  importe_a_pagar: 222.22,
  importe_con_beneficio: null,
  fecha_calculo: `${year}-02-11`,
  observacion: 'Acta ficticia',
  codigo_infraccion: 'k1',
  uit: 'p-uit',
  obligado: 'c1',
  contribuyente: 'c1',
  predio: null,
  notificacion_previa: 'n1',
  ...valores
})

const expediente = (valores: Partial<ExpedienteInfraccion> = {}): ExpedienteInfraccion => ({
  acta: papeleta(),
  referencia: 'PAPELETA-a1',
  codigo_infraccion: cuis({ vigencia_desde: `${year - 1}-01-01`, vigencia_hasta: `${year}-12-31`, base_legal: 'Ordenanza ficticia 000, art. 1' }),
  notificacion_previa: {
    id: 'n1',
    numero: 'NP-0001',
    fecha: `${year}-02-01`,
    direccion: 'Jr. Ficticio 123',
    motivo: 'Motivo ficticio',
    plazo_dias: 5,
    observacion: 'Notificación ficticia',
    contribuyente: 'c1',
    predio: null
  },
  // the legal order, as the backend sends it: the dates do not go up on purpose, so a sort here would show
  actos: [
    { orden: 1, acto: 'Notificación previa', fecha: `${year}-02-01`, documento: 'NP-0001', id: 'n1', detalle: 'Vencida' },
    { orden: 2, acto: 'Acta de constatación', fecha: `${year}-02-10`, documento: 'ACTA-0001', id: 'a1', detalle: null },
    { orden: 3, acto: 'Descargo', fecha: `${year}-02-12`, documento: 'EXP-D-1', id: 'd1', detalle: 'En plazo' },
    { orden: 4, acto: 'Resolución', fecha: `${year}-01-30`, documento: `RIS-${year}-000001`, id: 'r1', detalle: 'Notificada' }
  ],
  descargos: [],
  resoluciones: [],
  anulacion: null,
  fase: 'SANCIONADA',
  fase_al_dia: hoy(),
  estado_de_la_deuda: 'PENDIENTE',
  acciones: {
    descargo: { permitida: true, motivo: null },
    resolucion: { permitida: true, motivo: null },
    anulacion: { permitida: true, motivo: null }
  },
  ...valores
})

const contribuyentes = {
  path: '/srtm/contribuyentes',
  body: { content: [{ id: 'c7', numero_documento: '00000007', nombre_completo: 'OTRO FICTICIO' }], page: 0, size: 8, totalElements: 1, totalPages: 1 }
}
const predios = {
  path: '/srtm/predios',
  body: { content: [{ id: 'p3', codigo: 'P-0003', direccion: 'Av. Ficticia 9' }], page: 0, size: 8, totalElements: 1, totalPages: 1 }
}

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

const celdas = (tr: HTMLElement) =>
  within(tr)
    .getAllByRole('cell')
    .map((c) => soles(c.textContent))
const fila = (t: HTMLElement, texto: string) => within(t).getByText(texto).closest('tr')!

describe('Expedientes', () => {
  const tabla = () => screen.findByRole('table', { name: `Expedientes, fase al ${dmy(hoy())}` })
  const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/infracciones/actas'))

  it('shows the backend importe with its date, and the fase and the estado de la deuda as two named columns', async () => {
    start('/infracciones', [
      {
        path: '/srtm/infracciones/actas',
        body: pagina([
          procedimiento(),
          procedimiento({ id: 'a2', numero: 'ACTA-0002', fase: null, estado_de_la_deuda: 'ANULADA', documento: null }),
          procedimiento({ id: 'a3', numero: 'ACTA-0003', fase: null, estado_de_la_deuda: 'DEJADA_SIN_EFECTO', medida_complementaria: null }),
          procedimiento({ id: 'a4', numero: 'ACTA-0004', fase: 'SANCIONADA' })
        ])
      }
    ])
    const t = await tabla()
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Número', 'Fecha', 'Administrado', 'Código', '% infracción', 'Importe a pagar', 'Medida', `Fase al ${dmy(hoy())}`, 'Estado de la deuda'])
    expect(celdas(fila(t, 'ACTA-0001'))).toEqual([
      'ACTA-0001',
      `10/02/${year}`,
      'ADMINISTRADO FICTICIO00000001',
      'X-001Infracción ficticia de prueba',
      '10 %',
      `S/ 987.65al 11/02/${year}`,
      'Clausura ficticia',
      'Preventiva',
      'Pendiente'
    ])
    // 10 % of nothing on screen: the backend's amount, never one computed here
    expect(t.textContent).not.toMatch(/100[.,]00/)
    // annulled or left without effect: no fase ("—", never the nearest one), and the estado says why
    expect(celdas(fila(t, 'ACTA-0002')).slice(7)).toEqual(['—', 'Anulada'])
    expect(celdas(fila(t, 'ACTA-0003')).slice(6)).toEqual(['—', '—', 'Dejada sin efecto'])
    expect(celdas(fila(t, 'ACTA-0004')).slice(7)).toEqual(['Sancionada', 'Pendiente'])
    expect(within(fila(t, 'ACTA-0001')).getByRole('link', { name: 'ACTA-0001' })).toHaveAttribute('href', '/infracciones/a1')
  })

  it('filters by número, administrado, código, fase and dates; Todas sends no fase', async () => {
    start('/infracciones', [{ path: '/srtm/infracciones/actas', body: pagina([procedimiento()]) }])
    await tabla()
    expect(Object.fromEntries(new URLSearchParams(lecturas()[0].path.split('?')[1]))).toEqual({ page: '0', size: '20' })
    expect(
      within(screen.getByLabelText('Fase'))
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Todas', 'Preventiva', 'Constatada', 'Sancionada'])
    fireEvent.change(screen.getByLabelText('Número de acta'), { target: { value: ' acta-1 ' } })
    fireEvent.change(screen.getByLabelText('Administrado'), { target: { value: 'FICTICIO' } })
    fireEvent.change(screen.getByLabelText('Código CUIS'), { target: { value: 'X-001' } })
    await userEvent.selectOptions(screen.getByLabelText('Fase'), 'CONSTATADA')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: `${year}-01-01` } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: `${year}-01-31` } })
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(lecturas()).toHaveLength(2))
    expect(Object.fromEntries(new URLSearchParams(lecturas()[1].path.split('?')[1]))).toEqual({
      numero: 'acta-1',
      administrado: 'FICTICIO',
      codigo: 'X-001',
      fase: 'CONSTATADA',
      desde: `${year}-01-01`,
      hasta: `${year}-01-31`,
      page: '0',
      size: '20'
    })
    await userEvent.selectOptions(screen.getByLabelText('Fase'), '')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(lecturas()).toHaveLength(3))
    expect(new URLSearchParams(lecturas()[2].path.split('?')[1]).has('fase')).toBe(false)
  })

  it('opens the expediente from its row', async () => {
    start('/infracciones', [
      { path: '/srtm/infracciones/actas', body: pagina([procedimiento()]) },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    const t = await tabla()
    await userEvent.click(within(fila(t, 'ACTA-0001')).getByText('ADMINISTRADO FICTICIO'))
    expect(await screen.findByRole('table', { name: 'Actos del expediente' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/infracciones/a1')
  })

  it('keeps its queries under the infracciones keys', () => {
    expect(claves.actas({ numero: 'A', fase: 'PREVENTIVA', hasta: `${year}-01-31` }, 3)).toEqual([
      'infracciones',
      'actas',
      'A',
      null,
      null,
      'PREVENTIVA',
      null,
      `${year}-01-31`,
      3
    ])
    expect(claves.acta('a1')).toEqual(['infracciones', 'acta', 'a1'])
  })

  it('without CREATE on papeleta a new acta is impeded, and says why', async () => {
    start('/infracciones', [{ path: '/srtm/infracciones/actas', body: pagina([procedimiento()]) }], {
      permisos: { admin: false, objects: { papeleta: ['READ'] } }
    })
    await tabla()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva acta' })).toBeDisabled())
    expect(screen.getByText('Sin permiso: registrar un acta pide creación sobre las papeletas.')).toBeInTheDocument()
  })
})

describe('Nueva acta', () => {
  const formulario = () => screen.findByRole('form', { name: 'Nueva acta' })
  const registrar = () => screen.getByRole('button', { name: 'Registrar acta' })
  const cuisLeidos = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/infracciones/cuis'))
  const elegir = async (campo: RegExp, texto: string, opcion: string) => {
    fireEvent.change(screen.getByLabelText(campo), { target: { value: texto } })
    await userEvent.click(await screen.findByRole('button', { name: opcion }))
  }
  // everything an acta needs but the obligado
  const llenarSinObligado = async () => {
    fireEvent.change(screen.getByLabelText(/^Número de acta/), { target: { value: ' ACTA-0009 ' } })
    fireEvent.change(screen.getByLabelText(/^Fecha de la infracción/), { target: { value: `${year}-02-10` } })
    fireEvent.change(screen.getByLabelText(/^Hora/), { target: { value: '10:30' } })
    fireEvent.change(screen.getByLabelText(/^Lugar/), { target: { value: 'Jr. Ficticio 123' } })
    await waitFor(() => expect(within(screen.getByLabelText(/^Código CUIS/)).getAllByRole('option')).toHaveLength(2))
    await userEvent.selectOptions(screen.getByLabelText(/^Código CUIS/), 'X-001')
    await userEvent.selectOptions(screen.getByLabelText(/^Reincidencia/), 'SEGUNDA')
    await elegir(/^Contribuyente/, 'OTRO', '00000007 · OTRO FICTICIO')
    fireEvent.change(screen.getByLabelText(/^Observación/), { target: { value: 'Operativo ficticio' } })
  }
  const rutasCuis = (): MockRoute[] => [
    // the list follows the infraction date: another code that day
    { path: new RegExp(`^/srtm/infracciones/cuis\\?vigentes_a=${year}-02-10`), body: catalogo({ vigentes_a: `${year}-02-10` }) },
    { path: '/srtm/infracciones/cuis', body: catalogo({ codigos: [cuis({ id: 'k9', codigo: 'Y-009', descripcion: 'Otra infracción ficticia' })] }) }
  ]

  it('lists the CUIS in force on the infraction date, and asks again when the date changes', async () => {
    start('/infracciones/nueva', [...rutasCuis()])
    await formulario()
    const codigo = screen.getByLabelText(/^Código CUIS/)
    await waitFor(() =>
      expect(
        within(codigo)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual([`Elija un código vigente al ${dmy(hoy())}`, 'Y-009 · Otra infracción ficticia'])
    )
    expect(new URLSearchParams(cuisLeidos()[0].path.split('?')[1]).get('vigentes_a')).toBe(hoy())
    await userEvent.selectOptions(codigo, 'Y-009')
    fireEvent.change(screen.getByLabelText(/^Fecha de la infracción/), { target: { value: `${year}-02-10` } })
    await waitFor(() =>
      expect(
        within(codigo)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual([`Elija un código vigente al 10/02/${year}`, 'X-001 · Infracción ficticia de prueba'])
    )
    // the code picked for the other day is no longer picked
    expect(codigo).toHaveValue('')
    await userEvent.selectOptions(codigo, 'X-001')
    expect(screen.getByTestId('codigo-elegido')).toHaveTextContent('Base legal: Ordenanza ficticia 000. Medida complementaria: Clausura ficticia.')
  })

  it('names what the CUIS lacks to compute a multa on that day, before sending', async () => {
    start('/infracciones/nueva', [{ path: '/srtm/infracciones/cuis', body: catalogo({ uit: null, faltan: [`UIT ${year}`] }) }])
    await formulario()
    expect(await screen.findByText(`UIT ${year}. Sin eso no se cifra la multa del acta.`)).toBeInTheDocument()
    expect(screen.getByText(`Al ${dmy(hoy())} falta:`)).toBeInTheDocument()
  })

  it('requires the obligado, chosen and not deduced from the contribuyente, and the contribuyente or the predio', async () => {
    start('/infracciones/nueva', [...rutasCuis(), contribuyentes, predios])
    await formulario()
    expect(screen.getByText('Obligado').closest('label')).toHaveTextContent('Obligado *')
    await llenarSinObligado()
    // the contribuyente is picked, the obligado is still empty: not filled from it
    expect(screen.getByLabelText(/^Obligado/)).toHaveValue('')
    expect(registrar()).toBeDisabled()
    expect(screen.getByText('Para registrar falta: el obligado.')).toBeInTheDocument()
    expect(screen.getByText('Quien responde por la multa. Se elige siempre: no se deduce del contribuyente ni del predio.')).toBeInTheDocument()
    // without the contribuyente nor a predio, it says so
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(screen.getByText('Para registrar falta: el obligado, el contribuyente o el predio.')).toBeInTheDocument()
    expect(screen.getByText('El contribuyente o el predio: al menos uno de los dos.')).toBeInTheDocument()
    await elegir(/^Predio/, 'P-00', 'P-0003 · Av. Ficticia 9')
    await elegir(/^Obligado/, 'OTRO', '00000007 · OTRO FICTICIO')
    expect(registrar()).toBeEnabled()
  })

  it('offers as notificación previa only the ones not subsanadas nor with an acta', async () => {
    const previa = (valores: Partial<NotificacionPrevia>): NotificacionPrevia => ({
      id: 'n1',
      numero: 'NP-0001',
      fecha: `${year}-02-01`,
      direccion: 'Jr. Ficticio 123',
      motivo: 'Motivo ficticio',
      plazo_dias: 5,
      observacion: 'Notificación ficticia',
      contribuyente: 'c7',
      predio: null,
      vencimiento: `${year}-02-06`,
      vencida: false,
      vencidas_a: hoy(),
      subsanada: null,
      acta: null,
      contribuyente_nombre: 'OTRO FICTICIO',
      ...valores
    })
    start('/infracciones/nueva', [
      ...rutasCuis(),
      {
        path: '/srtm/infracciones/notificaciones',
        body: pagina([
          previa({}),
          previa({ id: 'n2', numero: 'NP-0002', subsanada: { fecha: `${year}-02-03` } }),
          previa({ id: 'n3', numero: 'NP-0003', acta: { id: 'a7', numero: 'ACTA-7' } })
        ])
      }
    ])
    await formulario()
    fireEvent.change(screen.getByLabelText('Notificación previa'), { target: { value: 'NP' } })
    const lista = await screen.findByRole('list', { name: 'Resultados de notificación previa' })
    await waitFor(() =>
      expect(
        within(lista)
          .getAllByRole('button')
          .map((b) => b.textContent)
      ).toEqual([`NP-0001 · 01/02/${year} · OTRO FICTICIO`])
    )
    const leida = fetch!.calls.find((c) => c.path.startsWith('/srtm/infracciones/notificaciones'))!
    expect(new URLSearchParams(leida.path.split('?')[1]).get('numero')).toBe('NP')
  })

  it('sends the acta and shows the desglose the backend computed, with its date and referencia', async () => {
    const creada: ActaCreada = {
      ...papeleta({ id: 'a9', numero: 'ACTA-0009', contribuyente: 'c7', obligado: 'c7' }),
      referencia: 'PAPELETA-a9',
      desglose: {
        base_imponible: 1000,
        porcentaje_infraccion: 10,
        importe_infraccion: 111.11,
        porcentaje_a_cobrar: 20,
        importe_a_pagar: 222.22,
        importe_con_beneficio: null,
        fecha_calculo: `${year}-02-11`
      }
    }
    start('/infracciones/nueva', [
      { method: 'POST', path: '/srtm/infracciones/actas', status: 201, body: creada },
      { path: '/srtm/infracciones/actas/a9', body: expediente({ acta: creada, referencia: 'PAPELETA-a9' }) },
      ...rutasCuis(),
      contribuyentes,
      predios
    ])
    await formulario()
    await llenarSinObligado()
    await elegir(/^Obligado/, 'OTRO', '00000007 · OTRO FICTICIO')
    fireEvent.change(screen.getByLabelText('Inspector'), { target: { value: 'INSPECTOR FICTICIO' } })
    await userEvent.click(registrar())

    const desglose = await screen.findByRole('table', { name: `Desglose de la multa al 11/02/${year}` })
    expect(
      within(desglose)
        .getAllByRole('row')
        .slice(1)
        .map((r) => celdas(r))
    ).toEqual([
      ['Base imponible (UIT)', 'S/ 1,000.00'],
      ['% de la infracción', '10 %'],
      ['Importe de la infracción', 'S/ 111.11'],
      ['% a cobrar', '20 %'],
      ['Importe a pagar', 'S/ 222.22'],
      ['Con beneficio', '—'],
      ['Fecha de cálculo', `11/02/${year}`],
      ['Referencia', 'PAPELETA-a9']
    ])
    expect(screen.getByText(`Acta ACTA-0009 del 10/02/${year} registrada, con la referencia PAPELETA-a9.`)).toBeInTheDocument()
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({
      numero: 'ACTA-0009',
      fecha_infraccion: `${year}-02-10`,
      hora_infraccion: '10:30',
      lugar: 'Jr. Ficticio 123',
      codigo: 'X-001',
      reincidencia: 'SEGUNDA',
      obligado: 'c7',
      contribuyente: 'c7',
      predio: null,
      notificacion_previa: null,
      expediente: null,
      inspector: 'INSPECTOR FICTICIO',
      descripcion_hecho: null,
      observacion: 'Operativo ficticio'
    })
    await userEvent.click(screen.getByRole('link', { name: 'Ver el expediente' }))
    expect(await screen.findByRole('table', { name: 'Actos del expediente' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/infracciones/a9')
  })

  it('names in an Alerta what the backend lacks to compute the multa (422 faltan)', async () => {
    start('/infracciones/nueva', [
      {
        method: 'POST',
        path: '/srtm/infracciones/actas',
        status: 422,
        body: { title: 'Unprocessable Content', detail: 'Faltan parámetros', faltan: [`UIT ${year}`, 'CUIS X-001 porcentaje_uit_segunda'] }
      },
      ...rutasCuis(),
      contribuyentes
    ])
    await formulario()
    await llenarSinObligado()
    await elegir(/^Obligado/, 'OTRO', '00000007 · OTRO FICTICIO')
    await userEvent.click(registrar())
    expect(
      await screen.findByText(`UIT ${year}; CUIS X-001 porcentaje_uit_segunda. Sin eso no se cifra la multa: cárguelo y vuelva a intentarlo.`)
    ).toBeInTheDocument()
    expect(screen.getByText('No se registró el acta. Falta:')).toBeInTheDocument()
    // the form stays, to send again
    expect(registrar()).toBeEnabled()
  })

  it('shows any other refusal of the backend (409)', async () => {
    start('/infracciones/nueva', [
      { method: 'POST', path: '/srtm/infracciones/actas', status: 409, body: { title: 'Conflict', detail: 'Ya existe el acta ACTA-0009' } },
      ...rutasCuis(),
      contribuyentes
    ])
    await formulario()
    await llenarSinObligado()
    await elegir(/^Obligado/, 'OTRO', '00000007 · OTRO FICTICIO')
    await userEvent.click(registrar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe el acta ACTA-0009')
  })

  it('without CREATE on papeleta it is impeded, and says why', async () => {
    start('/infracciones/nueva', [...rutasCuis()], { permisos: { admin: false, objects: { papeleta: ['READ'] } } })
    await formulario()
    await waitFor(() => expect(screen.getByText('Sin permiso: registrar un acta pide creación sobre las papeletas.')).toBeInTheDocument())
    expect(registrar()).toBeDisabled()
  })
})

describe('Ficha del expediente', () => {
  const ficha = () => screen.findByRole('table', { name: 'Actos del expediente' })

  it('shows the fase and the estado de la deuda with their two names, the desglose with its date and the CUIS version used', async () => {
    start('/infracciones/a1', [{ path: '/srtm/infracciones/actas/a1', body: expediente() }])
    await ficha()
    expect(screen.getByRole('heading', { name: 'Acta ACTA-0001' })).toBeInTheDocument()
    expect(screen.getByTestId('fase')).toHaveTextContent(`Fase al ${dmy(hoy())}: Sancionada`)
    expect(screen.getByTestId('estado-deuda')).toHaveTextContent('Estado de la deuda: Pendiente')
    expect(screen.getByText('· Referencia PAPELETA-a1')).toBeInTheDocument()

    const desglose = screen.getByRole('table', { name: `Desglose de la multa al 11/02/${year}` })
    // the acta's frozen amounts, not base × % (1000 × 20 % would be 200)
    expect(celdas(within(desglose).getByText('Importe a pagar').closest('tr')!)).toEqual(['Importe a pagar', 'S/ 222.22'])
    expect(celdas(within(desglose).getByText('Importe de la infracción').closest('tr')!)).toEqual(['Importe de la infracción', 'S/ 111.11'])
    expect(desglose.textContent).not.toMatch(/200[.,]00/)

    const version = screen.getByLabelText('Código CUIS aplicado')
    expect(version).toHaveTextContent('CódigoX-001')
    expect(version).toHaveTextContent(`Vigencia01/01/${year - 1} – 31/12/${year}`)
    expect(version).toHaveTextContent('Base legalOrdenanza ficticia 000, art. 1')

    const datos = screen.getByLabelText('Datos del acta')
    expect(datos).toHaveTextContent('ReincidenciaSegunda vez')
    expect(datos).toHaveTextContent(`Fecha10/02/${year} 10:30`)
    expect(datos).toHaveTextContent(`Notificación previaNP-0001 del 01/02/${year}`)
    expect(within(datos).getByRole('link', { name: 'Ver el obligado' })).toHaveAttribute('href', '/contribuyentes/c1')
  })

  it('without a fase (annulled) shows "—" beside the estado, never the nearest fase', async () => {
    start('/infracciones/a1', [
      {
        path: '/srtm/infracciones/actas/a1',
        body: expediente({
          fase: null,
          estado_de_la_deuda: 'ANULADA',
          anulacion: { id: 'x1', fecha: `${year}-03-01`, motivo: 'Error material ficticio', observacion: 'x', clave: 'a1', papeleta: 'a1' },
          acciones: {
            descargo: { permitida: false, motivo: 'Acta anulada' },
            resolucion: { permitida: false, motivo: 'Acta anulada' },
            anulacion: { permitida: false, motivo: `Ya se anuló el 01/03/${year}.` }
          }
        })
      }
    ])
    await ficha()
    expect(screen.getByTestId('fase')).toHaveTextContent(`Fase al ${dmy(hoy())}: —`)
    expect(screen.getByTestId('estado-deuda')).toHaveTextContent('Estado de la deuda: Anulada')
    expect(screen.getByText(`El 01/03/${year}: Error material ficticio`)).toBeInTheDocument()
  })

  it('lists the actos in the order the backend gives, with the legal note', async () => {
    start('/infracciones/a1', [{ path: '/srtm/infracciones/actas/a1', body: expediente() }])
    const t = await ficha()
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Nº', 'Acto', 'Fecha', 'Documento', 'Estado'])
    expect(
      within(t)
        .getAllByRole('row')
        .slice(1)
        .map((r) => celdas(r))
    ).toEqual([
      ['1', 'Notificación previa', `01/02/${year}`, 'NP-0001', 'Vencida'],
      ['2', 'Acta de constatación', `10/02/${year}`, 'ACTA-0001', '—'],
      ['3', 'Descargo', `12/02/${year}`, 'EXP-D-1', 'En plazo'],
      ['4', 'Resolución', `30/01/${year}`, `RIS-${year}-000001`, 'Notificada']
    ])
    expect(
      screen.getByText('El orden es legal, no una preferencia: sin acta no hay resolución, y sin notificación la sanción no es exigible.')
    ).toBeInTheDocument()
  })

  it('impedes the anulación with the reason the backend gives', async () => {
    start('/infracciones/a1', [
      {
        path: '/srtm/infracciones/actas/a1',
        body: expediente({
          acciones: {
            descargo: { permitida: true, motivo: null },
            resolucion: { permitida: true, motivo: null },
            anulacion: { permitida: false, motivo: 'Una resolución la dejó sin efecto: no queda nada que anular.' }
          }
        })
      }
    ])
    await ficha()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeDisabled()
    expect(screen.getByText('Una resolución la dejó sin efecto: no queda nada que anular.')).toBeInTheDocument()
  })

  it('without CREATE on anulacion_papeleta the anulación is impeded, and says why', async () => {
    start('/infracciones/a1', [{ path: '/srtm/infracciones/actas/a1', body: expediente() }], {
      permisos: { admin: false, objects: { papeleta: ['READ'], anulacion_papeleta: ['READ'] } }
    })
    await ficha()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Anular' })).toBeDisabled())
    expect(screen.getByText('Sin permiso: anular pide creación sobre las anulaciones de papeleta.')).toBeInTheDocument()
  })

  it('annuls with motivo, fecha and observación, and reads the expediente again', async () => {
    start('/infracciones/a1', [
      {
        method: 'POST',
        path: '/srtm/infracciones/actas/a1/anulacion',
        status: 201,
        body: { id: 'x1', fecha: `${year}-03-01`, motivo: 'Error material', observacion: 'x', clave: 'a1', papeleta: 'a1' }
      },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    await ficha()
    const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path === '/srtm/infracciones/actas/a1').length
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Anular el acta ACTA-0001' })
    const anular = within(dialogo).getByRole('button', { name: 'Anular' })
    fireEvent.change(within(dialogo).getByLabelText('Observación'), { target: { value: 'Revisión ficticia' } })
    // the motivo is still missing
    expect(anular).toBeDisabled()
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: ' Error material ' } })
    fireEvent.change(within(dialogo).getByLabelText('Fecha de la anulación'), { target: { value: `${year}-03-01` } })
    const antes = lecturas()
    await userEvent.click(anular)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ motivo: 'Error material', fecha: `${year}-03-01`, observacion: 'Revisión ficticia' })
    await waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
  })

  it('shows the backend refusal of the anulación inside the dialog, and sends no fecha when blank', async () => {
    start('/infracciones/a1', [
      { method: 'POST', path: '/srtm/infracciones/actas/a1/anulacion', status: 409, body: { title: 'Conflict', detail: 'El acta ya está anulada' } },
      { path: '/srtm/infracciones/actas/a1', body: expediente() }
    ])
    await ficha()
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'Error material' } })
    fireEvent.change(within(dialogo).getByLabelText('Observación'), { target: { value: 'Revisión ficticia' } })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El acta ya está anulada')
    expect(fetch!.calls.find((c) => c.method === 'POST')!.body).toEqual({ motivo: 'Error material', observacion: 'Revisión ficticia' })
  })

  it('stays open as a workspace tab', async () => {
    start('/infracciones/a1', [{ path: '/srtm/infracciones/actas/a1', body: expediente() }])
    await ficha()
    const pestanas = screen.getByRole('navigation', { name: 'Fichas abiertas' })
    expect(await within(pestanas).findByRole('link', { name: 'Acta ACTA-0001' })).toHaveAttribute('aria-current', 'page')
    expect(JSON.parse(sessionStorage.getItem(TABS_KEY) ?? '[]')).toEqual([{ path: '/infracciones/a1', label: 'Acta ACTA-0001', kind: 'expediente' }])
  })
})

describe('Expedientes en los dos temas', () => {
  it.each(['light', 'portal-tributario'])('shows the grid and the ficha with the backend figures and both names with %s', async (theme) => {
    start(
      '/infracciones',
      [
        { path: '/srtm/infracciones/actas', body: pagina([procedimiento({ fase: 'CONSTATADA' })]) },
        { path: '/srtm/infracciones/actas/a1', body: expediente() }
      ],
      { theme }
    )
    const t = await screen.findByRole('table', { name: `Expedientes, fase al ${dmy(hoy())}` })
    expect(celdas(fila(t, 'ACTA-0001')).slice(5)).toEqual([`S/ 987.65al 11/02/${year}`, 'Clausura ficticia', 'Constatada', 'Pendiente'])
    await userEvent.click(within(t).getByRole('link', { name: 'ACTA-0001' }))
    await screen.findByRole('table', { name: 'Actos del expediente' })
    expect(screen.getByTestId('fase')).toHaveTextContent('Sancionada')
    expect(screen.getByTestId('estado-deuda')).toHaveTextContent('Pendiente')
    expect(screen.getByRole('table', { name: `Desglose de la multa al 11/02/${year}` }).textContent).toMatch(/222[.,]22/)
  })
})

describe('menú de los expedientes', () => {
  it('the classic menu entry Infracciones opens the expedientes, current on a ficha too', async () => {
    start('/infracciones/a1', [{ path: '/srtm/infracciones/actas/a1', body: expediente() }], { theme: 'light' })
    await screen.findByRole('table', { name: 'Actos del expediente' })
    const lateral = screen.getByRole('navigation', { name: 'Secciones' })
    const entrada = within(lateral).getByRole('link', { name: 'Infracciones' })
    expect(entrada).toHaveAttribute('href', '/infracciones')
    expect(entrada).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['/infracciones', 'Expedientes'],
    ['/infracciones/a1', 'Expedientes'],
    ['/infracciones/nueva', 'Nueva acta']
  ])('the tree menu has Expedientes and Nueva acta first in the group; on %s %s is current', async (path, actual) => {
    start(
      path,
      [
        { path: '/srtm/infracciones/actas', body: pagina([procedimiento()]) },
        { path: '/srtm/infracciones/actas/a1', body: expediente() },
        { path: '/srtm/infracciones/cuis', body: catalogo() }
      ],
      { theme: 'portal-tributario' }
    )
    const lateral = screen.getByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(within(lateral).getByRole('link', { name: actual })).toHaveAttribute('aria-current', 'page'))
    const hojas = within(lateral)
      .getAllByRole('link')
      .map((l) => l.textContent)
    const desde = hojas.indexOf('Expedientes')
    expect(hojas.slice(desde, desde + 4)).toEqual(['Expedientes', 'Nueva acta', 'Notificaciones previas', 'CUIS'])
    expect(
      within(lateral)
        .getAllByRole('link')
        .filter((l) => l.getAttribute('aria-current') === 'page')
    ).toHaveLength(1)
  })

  it('the subnav links the expedientes and the nueva acta first', async () => {
    start('/infracciones', [{ path: '/srtm/infracciones/actas', body: pagina([procedimiento()]) }], { theme: 'light' })
    await screen.findByRole('table')
    const subnav = screen.getByRole('navigation', { name: 'Infracciones administrativas' })
    expect(within(subnav).getByRole('link', { name: 'Expedientes' })).toHaveAttribute('aria-current', 'page')
    expect(
      within(subnav)
        .getAllByRole('link')
        .map((l) => l.getAttribute('href'))
    ).toEqual(['/infracciones', '/infracciones/nueva', '/infracciones/notificaciones', '/infracciones/cuis', '/infracciones/plazos'])
  })
})
