import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { claves } from './queries'
import type { InfraccionesDe, NotificacionPrevia, NotificacionVencida, Pagina, PanelInfracciones, PlazosInfracciones, Procedimiento } from './types'

// escalas y plazos, el panel y la pestaña Infracciones de las fichas (épica de infracciones administrativas, PR U5):
// el panel muestra las cifras del backend, cada una con su fecha, y «En coactiva» como «no aplica» con la nota del
// backend (nunca un 0); las vencidas sin acta a una fecha de corte que se ve; las notificaciones de un contribuyente;
// los plazos y feriados cargados de un año tal como los lee el backend (también el siguiente), con lo que falta en una
// Alert, y cómo se cargan; la pestaña de las dos fichas con la fase y
// el estado de la deuda en dos columnas con sus nombres, también durante la inscripción; las dos estructuras de tema y
// los menús. números, nombres, fechas e importes FICTICIOS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const usuario = { ...admin, id: 'u2', email: 'ventanilla@wasichai.local', displayName: 'Ventanilla', roles: [] }
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

const pagina = <T,>(content: T[]): Pagina<T> => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const panel = (valores: Partial<PanelInfracciones> = {}): PanelInfracciones => ({
  anio: year,
  // a day of its own, not today: the cards must show the backend's
  al_dia: `${year}-03-04`,
  actas: 17,
  resoluciones: 5,
  notificadas: 3,
  vencen_esta_semana: 4,
  semana: { desde: `${year}-03-02`, hasta: `${year}-03-08` },
  coactiva: null,
  nota: 'En coactiva no existe en srtm: no hay cobranza',
  ...valores
})

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
  medida_complementaria: null,
  fase: 'SANCIONADA',
  fase_al_dia: `${year}-03-04`,
  estado_de_la_deuda: 'PENDIENTE',
  ...valores
})

const infracciones = (actas: Procedimiento[] = [procedimiento()]): InfraccionesDe => ({ al_dia: `${year}-03-04`, actas })

const vencidaSinActa = (valores: Partial<NotificacionVencida> = {}): NotificacionVencida => ({
  id: 'n1',
  numero: 'NP-0001',
  fecha: `${year}-01-05`,
  direccion: 'Jr. Ficticio 123',
  motivo: 'Motivo ficticio',
  plazo_dias: 5,
  observacion: 'Notificación ficticia',
  contribuyente: 'c1',
  predio: null,
  // the backend's: not fecha + 5 on purpose
  vencimiento: `${year}-01-19`,
  corte: hoy(),
  contribuyente_nombre: 'CONTRIBUYENTE FICTICIO',
  ...valores
})

const plazos = (valores: Partial<PlazosInfracciones> = {}): PlazosInfracciones => ({
  anio: year,
  al_dia: `${year}-01-01`,
  plazos: [
    {
      clave: 'DESCARGO_PAPELETA',
      dias: 7,
      unidad: 'DIAS_HABILES',
      texto: '7 DIAS_HABILES',
      vigencia_desde: `${year - 3}-01-01`,
      vigencia_hasta: null,
      parametro_id: 'p-desc'
    },
    {
      clave: 'RG_RECURSO',
      dias: 13,
      unidad: 'DIAS_HABILES',
      texto: '13 DIAS_HABILES',
      vigencia_desde: `${year}-01-01`,
      vigencia_hasta: `${year}-12-31`,
      parametro_id: 'p-rg'
    }
  ],
  feriados: { fechas: [`${year}-02-17`, `${year}-09-23`], parametro_id: 'p-fer' },
  faltan: [],
  ...valores
})

const notificacion = (valores: Partial<NotificacionPrevia> = {}): NotificacionPrevia => ({
  id: 'n7',
  numero: 'NP-0007',
  fecha: `${year}-01-05`,
  direccion: 'Jr. Ficticio 123',
  motivo: 'Motivo ficticio',
  plazo_dias: 5,
  observacion: 'Notificación ficticia',
  contribuyente: 'c7',
  predio: null,
  vencimiento: `${year}-01-19`,
  vencida: true,
  vencidas_a: hoy(),
  subsanada: null,
  acta: { id: 'a7', numero: 'ACTA-0007' },
  contribuyente_nombre: 'OTRO FICTICIO',
  ...valores
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

function start(path: string, routes: MockRoute[], { permisos, theme, user = admin }: { permisos?: unknown; theme?: string; user?: unknown } = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(user))
  if (theme) localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', path)
  fetch = mockFetch([...routes, ...base(permisos, theme)])
  render(<PortalApp />)
}

const lecturas = (prefijo: string) => fetch!.calls.filter((c) => c.method === 'GET' && c.path.split('?')[0] === prefijo)
const params = (path: string) => Object.fromEntries(new URLSearchParams(path.split('?')[1]))

// a stat card: its label, figure, date and nota
const tarjeta = async (label: string) => {
  const region = await screen.findByRole('region', { name: 'Panel de infracciones' })
  return (await within(region).findByText(label)).parentElement!
}

const rutasExpedientes = (p: PanelInfracciones = panel()): MockRoute[] => [
  { path: '/srtm/infracciones/panel', body: p },
  { path: '/srtm/infracciones/actas', body: pagina([procedimiento()]) }
]

describe('panel de infracciones', () => {
  it('shows the backend figures, each with its date, and the week they fall due in', async () => {
    start('/infracciones', rutasExpedientes())
    expect((await tarjeta('Actas levantadas')).textContent).toBe(`Actas levantadas17al ${dmy(`${year}-03-04`)}`)
    expect((await tarjeta('Resoluciones de sanción (RIS)')).textContent).toBe(`Resoluciones de sanción (RIS)5al ${dmy(`${year}-03-04`)}`)
    expect((await tarjeta('Notificadas')).textContent).toBe(`Notificadas3al ${dmy(`${year}-03-04`)}`)
    const semana = await tarjeta('Vencen esta semana')
    expect(within(semana).getByText('4')).toBeInTheDocument()
    expect(within(semana).getByText(`al ${dmy(`${year}-03-04`)}`)).toBeInTheDocument()
    expect(within(semana).getByText(`del ${dmy(`${year}-03-02`)} al ${dmy(`${year}-03-08`)}`)).toBeInTheDocument()
    // asked for this year by default
    expect(params(lecturas('/srtm/infracciones/panel')[0].path)).toEqual({ anio: String(year) })
  })

  it('says «no aplica» for coactiva with the backend nota, never a 0', async () => {
    start('/infracciones', rutasExpedientes(panel({ nota: 'Nota ficticia del backend' })))
    const coactiva = await tarjeta('En coactiva')
    expect(within(coactiva).getByText(/no aplica/i)).toBeInTheDocument()
    expect(within(coactiva).getByText('Nota ficticia del backend')).toBeInTheDocument()
    expect(coactiva.textContent).not.toMatch(/\b0\b/)
  })

  it('asks again for another year', async () => {
    start('/infracciones', rutasExpedientes())
    await tarjeta('Actas levantadas')
    fireEvent.change(within(screen.getByRole('region', { name: 'Panel de infracciones' })).getByLabelText('Año'), { target: { value: String(year - 1) } })
    await waitFor(() => expect(lecturas('/srtm/infracciones/panel')).toHaveLength(2))
    expect(params(lecturas('/srtm/infracciones/panel')[1].path)).toEqual({ anio: String(year - 1) })
    expect(await screen.findByText(`Ejercicio ${year - 1}`)).toBeInTheDocument()
  })

  it.each(['light', 'portal-tributario'])('shows the backend figures and coactiva «no aplica» with %s', async (theme) => {
    start('/infracciones', rutasExpedientes(), { theme })
    expect(within(await tarjeta('Actas levantadas')).getByText('17')).toBeInTheDocument()
    expect(within(await tarjeta('En coactiva')).getByText(/no aplica/i)).toBeInTheDocument()
    // the grid is still there under it
    expect(await screen.findByRole('table', { name: `Expedientes, fase al ${dmy(`${year}-03-04`)}` })).toBeInTheDocument()
  })

  it('keeps its queries under the infracciones keys', () => {
    expect(claves.panel(year)).toEqual(['infracciones', 'panel', year])
    expect(claves.plazos(year + 1)).toEqual(['infracciones', 'plazos', year + 1])
    expect(claves.vencidas(`${year}-03-04`, 2)).toEqual(['infracciones', 'vencidas', `${year}-03-04`, 2])
    expect(claves.notificacionesDe('c7', 0)).toEqual(['infracciones', 'notificaciones-de', 'c7', 0])
    expect(claves.infraccionesDe('predios', 'p1')).toEqual(['infracciones', 'de', 'predios', 'p1'])
  })
})

describe('Escalas y plazos', () => {
  const rutas = (vencidas: NotificacionVencida[] = [vencidaSinActa()], cargados: PlazosInfracciones = plazos()): MockRoute[] => [
    { path: '/srtm/infracciones/plazos', body: cargados },
    { path: '/srtm/infracciones/notificaciones/vencidas', body: pagina(vencidas) },
    { path: '/srtm/infracciones/notificaciones/por-contribuyente', body: pagina([notificacion()]) },
    {
      path: '/srtm/contribuyentes',
      body: { content: [{ id: 'c7', numero_documento: '00000007', nombre_completo: 'OTRO FICTICIO' }], page: 0, size: 8, totalElements: 1, totalPages: 1 }
    }
  ]

  it('lists the vencidas without acta at the corte, today by default, with the backend vencimiento', async () => {
    start('/infracciones/plazos', rutas())
    const t = await screen.findByRole('table', { name: `Vencidas sin acta al ${dmy(hoy())}` })
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Número', 'Fecha', 'Administrado', 'Dirección', 'Plazo', 'Vencimiento'])
    const [, fila] = within(t).getAllByRole('row')
    expect(
      within(fila)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['NP-0001', `05/01/${year}`, 'CONTRIBUYENTE FICTICIO', 'Jr. Ficticio 123', '5 días', `19/01/${year}`])
    expect(within(fila).getByRole('link', { name: 'CONTRIBUYENTE FICTICIO' })).toHaveAttribute('href', '/contribuyentes/c1')
    // fecha + 5 is not on screen: the vencimiento is the backend's
    expect(t.textContent).not.toContain(`10/01/${year}`)
    expect(params(lecturas('/srtm/infracciones/notificaciones/vencidas')[0].path)).toEqual({ corte: hoy(), page: '0', size: '20' })
  })

  it('asks at another corte and shows the corte the backend applied', async () => {
    start('/infracciones/plazos', rutas([vencidaSinActa({ corte: `${year}-02-15` })]))
    await screen.findByRole('table', { name: `Vencidas sin acta al 15/02/${year}` })
    fireEvent.change(screen.getByLabelText('Fecha de corte'), { target: { value: `${year}-02-15` } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(lecturas('/srtm/infracciones/notificaciones/vencidas')).toHaveLength(2))
    expect(params(lecturas('/srtm/infracciones/notificaciones/vencidas')[1].path).corte).toBe(`${year}-02-15`)
  })

  it('says when none is vencida at the corte', async () => {
    start('/infracciones/plazos', rutas([]))
    expect(await screen.findByText(`Ninguna notificación previa vencida sin acta al ${dmy(hoy())}.`)).toBeInTheDocument()
  })

  it("lists a contribuyente's notificaciones once one is chosen, by its id", async () => {
    start('/infracciones/plazos', rutas())
    await screen.findByRole('table', { name: `Vencidas sin acta al ${dmy(hoy())}` })
    expect(lecturas('/srtm/infracciones/notificaciones/por-contribuyente')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Contribuyente'), { target: { value: 'OTRO' } })
    fireEvent.click(await screen.findByRole('button', { name: '00000007 · OTRO FICTICIO' }))
    const t = await screen.findByRole('table', { name: `Notificaciones de 00000007 · OTRO FICTICIO, vencidas al ${dmy(hoy())}` })
    expect(params(lecturas('/srtm/infracciones/notificaciones/por-contribuyente')[0].path)).toEqual({ contribuyente: 'c7', page: '0', size: '20' })
    const [, fila] = within(t).getAllByRole('row')
    expect(
      within(fila)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['NP-0007', `05/01/${year}`, 'Motivo ficticio', '5 días', `19/01/${year}`, 'Vencida', 'No', 'ACTA-0007'])
    expect(within(fila).getByRole('link', { name: 'ACTA-0007' })).toHaveAttribute('href', '/infracciones/a7')
  })

  const cargados = () => screen.findByRole('region', { name: 'Plazos cargados' })

  it("lists the year's plazos and feriados as the backend reads them, this year by default", async () => {
    start('/infracciones/plazos', rutas())
    const seccion = await cargados()
    const t = await within(seccion).findByRole('table', { name: `Plazos de ${year}, vigentes al 01/01/${year}` })
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Clave', 'Días', 'Unidad', 'Vigencia'])
    expect(
      within(t)
        .getAllByRole('row')
        .slice(1)
        .map((r) =>
          within(r)
            .getAllByRole('cell')
            .map((c) => c.textContent)
        )
    ).toEqual([
      ['PLAZO DESCARGO_PAPELETA', '7', 'Días hábiles', `01/01/${year - 3} – en adelante`],
      ['PLAZO RG_RECURSO', '13', 'Días hábiles', `01/01/${year} – 31/12/${year}`]
    ])
    expect(
      within(within(seccion).getByRole('list', { name: `Feriados de ${year}` }))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([`17/02/${year}`, `23/09/${year}`])
    expect(within(seccion).queryByRole('status')).not.toBeInTheDocument()
    expect(params(lecturas('/srtm/infracciones/plazos')[0].path)).toEqual({ anio: String(year) })
  })

  it('names in an Alert what the year lacks, never a 0', async () => {
    start('/infracciones/plazos', rutas([vencidaSinActa()], plazos({ plazos: [], feriados: null, faltan: [`PLAZO RG_RECURSO ${year}`, `FERIADOS ${year}`] })))
    const seccion = await cargados()
    // the Alert, not the loading status
    expect((await within(seccion).findByText(`Faltan para ${year}:`)).closest('[role="status"]')).toHaveTextContent(
      `Faltan para ${year}: PLAZO RG_RECURSO ${year}; FERIADOS ${year}. Un acto que los necesite no se registra hasta que se carguen.`
    )
    expect(within(seccion).queryByRole('table')).not.toBeInTheDocument()
    expect(within(seccion).queryByRole('list', { name: /^Feriados/ })).not.toBeInTheDocument()
  })

  it('asks for next year too, to check what is loaded before it applies', async () => {
    start('/infracciones/plazos', rutas())
    const seccion = await cargados()
    await within(seccion).findByRole('table', { name: `Plazos de ${year}, vigentes al 01/01/${year}` })
    const anio = within(seccion).getByLabelText('Año')
    expect(within(anio).getAllByRole('option')[0]).toHaveValue(String(year + 1))
    fireEvent.change(anio, { target: { value: String(year + 1) } })
    await waitFor(() => expect(lecturas('/srtm/infracciones/plazos')).toHaveLength(2))
    expect(params(lecturas('/srtm/infracciones/plazos')[1].path)).toEqual({ anio: String(year + 1) })
  })

  it('keeps saying how the plazos are configured, with the admin list for an admin', async () => {
    start('/infracciones/plazos', rutas())
    const seccion = await cargados()
    for (const texto of ['parametro_tributario', 'DESCARGO_PAPELETA', 'RG_RECURSO', 'FERIADOS', 'DIAS_HABILES', 'import_parametros.py']) {
      expect(within(seccion).getAllByText(texto).length).toBeGreaterThan(0)
    }
    expect(await within(seccion).findByRole('link', { name: 'lista de parámetros tributarios de la administración' })).toHaveAttribute(
      'href',
      '/admin/data/objects/parametro_tributario/records'
    )
    expect(within(seccion).getByRole('link', { name: 'CUIS' })).toHaveAttribute('href', '/infracciones/cuis')
  })

  it('without the ADMIN role names the administration without linking it', async () => {
    start('/infracciones/plazos', rutas(), { user: usuario, permisos: { admin: false, objects: {} } })
    await screen.findByRole('table', { name: `Vencidas sin acta al ${dmy(hoy())}` })
    const seccion = await cargados()
    expect(within(seccion).queryByRole('link', { name: /administración/ })).not.toBeInTheDocument()
    expect(seccion).toHaveTextContent('o en la administración (rol ADMIN).')
  })

  it.each(['light', 'portal-tributario'])('shows the vencidas with their corte with %s', async (theme) => {
    start('/infracciones/plazos', rutas(), { theme })
    expect(await screen.findByRole('table', { name: `Vencidas sin acta al ${dmy(hoy())}` })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Infracciones administrativas' })).toBeInTheDocument()
  })
})

const fichaContribuyente = {
  contribuyente: { id: 'c1', codigo: '000001', nombre_completo: 'ANA FICTICIA', numero_documento: '12345678' },
  predios: 0,
  totales: { autoavaluo: 0, valor_afecto: 0 }
}
const fichaPredio = { predio: { id: 'p1', codigo: '01-01-0001', direccion: 'JR. FICTICIO 123' }, titulares: 1, totales: { autoavaluo: 0, valor_afecto: 0 } }
const tablaDeLaFicha = () => screen.findByRole('table', { name: `Infracciones al ${dmy(`${year}-03-04`)}` })

describe('pestaña Infracciones de las fichas', () => {
  it("lists the contribuyente's actas with the importe and its date, and the fase and the estado as two named columns", async () => {
    const actas = [procedimiento(), procedimiento({ id: 'a2', numero: 'ACTA-0002', fase: null, estado_de_la_deuda: 'ANULADA' })]
    start('/contribuyentes/c1?tab=infracciones', [
      { path: '/srtm/contribuyentes/c1/infracciones', body: infracciones(actas) },
      { path: '/srtm/contribuyentes/c1', body: fichaContribuyente }
    ])
    const t = await tablaDeLaFicha()
    expect(screen.getByRole('tab', { name: 'Infracciones' })).toHaveAttribute('aria-selected', 'true')
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Número', 'Fecha', 'Código', 'Importe a pagar', `Fase al ${dmy(`${year}-03-04`)}`, 'Estado de la deuda'])
    const [, sancionada, anulada] = within(t).getAllByRole('row')
    const celdas = within(sancionada)
      .getAllByRole('cell')
      .map((c) => soles(c.textContent))
    expect(celdas[0]).toBe('ACTA-0001')
    expect(celdas[1]).toBe(`10/02/${year}`)
    expect(celdas[2]).toBe('X-001Infracción ficticia de prueba')
    expect(celdas[3]).toMatch(new RegExp(`987[.,]65al 11/02/${year}$`))
    expect(celdas[4]).toBe('Sancionada')
    expect(celdas[5]).toBe('Pendiente')
    expect(within(sancionada).getByRole('link', { name: 'ACTA-0001' })).toHaveAttribute('href', '/infracciones/a1')
    // annulled: no fase ("—", never the nearest one) beside its estado
    expect(
      within(anulada)
        .getAllByRole('cell')
        .slice(4)
        .map((c) => c.textContent)
    ).toEqual(['—', 'Anulada'])
    expect(screen.getByText(`Fase y estado de la deuda al ${dmy(`${year}-03-04`)}.`)).toBeInTheDocument()
  })

  it('comes after Arbitrios', async () => {
    start('/contribuyentes/c1?tab=infracciones', [
      { path: '/srtm/contribuyentes/c1/infracciones', body: infracciones() },
      { path: '/srtm/contribuyentes/c1', body: fichaContribuyente }
    ])
    await tablaDeLaFicha()
    const pestanas = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(pestanas.indexOf('Infracciones')).toBe(pestanas.indexOf('Arbitrios') + 1)
  })

  it('opens during the inscription once the fiscal domicilio is there (its step)', async () => {
    start('/contribuyentes/c1?tab=infracciones&inscripcion=1', [
      { path: '/srtm/contribuyentes/c1/infracciones', body: infracciones() },
      { path: '/srtm/contribuyentes/c1/domicilios', body: [{ id: 'd1', tipo_domicilio: 'FISCAL', estado: 'ACTIVO' }] },
      { path: '/srtm/contribuyentes/c1', body: fichaContribuyente }
    ])
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Infracciones' })).toBeEnabled())
  })

  it("lists the predio's actas, after Arbitrios", async () => {
    start('/predios/p1?tab=infracciones', [
      { path: '/srtm/predios/p1/infracciones', body: infracciones([procedimiento({ fase: 'CONSTATADA', estado_de_la_deuda: 'DEJADA_SIN_EFECTO' })]) },
      { path: '/srtm/predios/p1', body: fichaPredio }
    ])
    const t = await tablaDeLaFicha()
    expect(screen.getByRole('tab', { name: 'Infracciones' })).toHaveAttribute('aria-selected', 'true')
    const pestanas = screen.getAllByRole('tab').map((p) => p.textContent)
    expect(pestanas.indexOf('Infracciones')).toBe(pestanas.indexOf('Arbitrios') + 1)
    const [, fila] = within(t).getAllByRole('row')
    expect(
      within(fila)
        .getAllByRole('cell')
        .slice(4)
        .map((c) => c.textContent)
    ).toEqual(['Constatada', 'Dejada sin efecto'])
    expect(lecturas('/srtm/predios/p1/infracciones')).toHaveLength(1)
  })

  it('says when the predio has none', async () => {
    start('/predios/p1?tab=infracciones', [
      { path: '/srtm/predios/p1/infracciones', body: infracciones([]) },
      { path: '/srtm/predios/p1', body: fichaPredio }
    ])
    expect(await screen.findByText('Ninguna acta nombra este predio.')).toBeInTheDocument()
  })

  it.each(['light', 'portal-tributario'])('shows the fase and the estado with their two names with %s', async (theme) => {
    start(
      '/contribuyentes/c1?tab=infracciones',
      [
        { path: '/srtm/contribuyentes/c1/infracciones', body: infracciones() },
        { path: '/srtm/contribuyentes/c1', body: fichaContribuyente }
      ],
      { theme }
    )
    const t = await tablaDeLaFicha()
    expect(within(t).getByText('Sancionada')).toHaveAttribute('data-tono', 'rojo')
    expect(within(t).getByText('Pendiente')).toHaveAttribute('data-tono', 'ambar')
  })
})

describe('menú de escalas y plazos', () => {
  it('the menu bar has Escalas y plazos last in the group, current on its page', async () => {
    start('/infracciones/plazos', [{ path: '/srtm/infracciones/notificaciones/vencidas', body: pagina([]) }], { theme: 'portal-tributario' })
    const menu = screen.getByRole('navigation', { name: 'Secciones' })
    const grupo = within(menu).getByRole('button', { name: 'Infracciones administrativas' })
    await waitFor(() => expect(grupo).toHaveAttribute('aria-current', 'true'))
    fireEvent.click(grupo)
    const panel = document.getElementById(grupo.getAttribute('aria-controls')!)!
    expect(within(panel).getByRole('link', { name: 'Escalas y plazos' })).toHaveAttribute('aria-current', 'page')
    const hojas = within(panel)
      .getAllByRole('link')
      .map((l) => l.textContent)
    const desde = hojas.indexOf('Expedientes')
    expect(hojas.slice(desde, desde + 5)).toEqual(['Expedientes', 'Nueva acta', 'Notificaciones previas', 'CUIS', 'Escalas y plazos'])
    expect(
      within(menu)
        .getAllByRole('link')
        .filter((l) => l.getAttribute('aria-current') === 'page')
    ).toHaveLength(1)
  })

  it('the classic menu entry Infracciones is current on it, and the subnav links it last', async () => {
    start('/infracciones/plazos', [{ path: '/srtm/infracciones/notificaciones/vencidas', body: pagina([]) }], { theme: 'light' })
    await screen.findByText(`Ninguna notificación previa vencida sin acta al ${dmy(hoy())}.`)
    const lateral = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(lateral).getByRole('link', { name: 'Infracciones' })).toHaveAttribute('aria-current', 'page')
    const subnav = screen.getByRole('navigation', { name: 'Infracciones administrativas' })
    expect(within(subnav).getByRole('link', { name: 'Escalas y plazos' })).toHaveAttribute('aria-current', 'page')
    expect(
      within(subnav)
        .getAllByRole('link')
        .map((l) => l.getAttribute('href'))
        .at(-1)
    ).toBe('/infracciones/plazos')
  })
})
