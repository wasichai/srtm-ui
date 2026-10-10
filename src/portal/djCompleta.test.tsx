import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute, type RecordedCall } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// every declaration is created and edited in the full declaración jurada: no short form left (issue #10)

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '20529936',
  nombre_completo: 'QUISPE MAMANI JUAN',
  codigo: '000012'
}
const predio = {
  id: 'p1',
  codigo: '01-01-0001',
  numero_registro: 5243,
  tipo_predio: 'PREDIO RUSTICO',
  direccion: 'JR. LIMA 123',
  region: 'SELVA'
}
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  numero_declaracion: 39147,
  secuencia_uso: '1',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACION',
  area_terreno: 120,
  area_construida: 90,
  valor_autoavaluo: 10080.45,
  valor_condominio: null,
  deduccion: null,
  valor_afecto: 8000,
  tipo_adquisicion: 'COMPRA',
  fecha_adquisicion: '2024-09-04',
  folios: 2,
  documentos_sustento: 'MINUTA',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24'
}
const dj = { declaracion, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' }
const totales = { declaraciones: 1, autoavaluo: 10080.45, valor_afecto: 8000 }
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      predio: { tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'] },
      declaracion_predial: {
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        tipo_adquisicion: ['COMPRA', 'HERENCIA'],
        condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO']
      }
    }
  },
  { path: '/srtm/ubigeos', body: [] },
  { path: '/srtm/categorias-valor', body: [] },
  { path: '/srtm/contribuyentes', body: page([contribuyente]) },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/contribuyentes/c1/declaraciones', body: [{ declaracion, predio, contribuyente: null }] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente }] },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: '/srtm/declaraciones/d1/transferentes', body: [] },
  { path: '/srtm/declaraciones/d1/niveles', body: [] },
  { path: '/srtm/declaraciones/d1/obras', body: [] },
  { path: '/srtm/declaraciones/d1/frentes', body: [] }
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

// the first call that matches, once it is made: waitFor retries only while its callback throws
const called = (match: (c: RecordedCall) => boolean) =>
  waitFor(() => {
    const call = fetch!.calls.find(match)
    expect(call).toBeDefined()
    return call!
  })

const djHeading = () => screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })

// wasichai/srtm-ui#94: una fila BASE_ARBITRIO en vigor
const filaBase = (clave: string, texto: string) => ({
  id: null,
  tipo: 'BASE_ARBITRIO',
  clave,
  texto,
  vigencia_desde: null,
  vigencia_hasta: null,
  valor_numerico: null,
  norma: null,
  fuente: null,
  transcribio: null,
  verifico: null
})

describe('the full declaración jurada', () => {
  it("edits a declaration from the contribuyente's ficha in the full dj", async () => {
    start('/contribuyentes/c1?tab=declaraciones')
    const lapiz = await screen.findByRole('link', { name: `Editar declaración ${year}` })
    expect(lapiz).toHaveAttribute('href', '/declaraciones/d1')
    await userEvent.click(lapiz)
    expect(await djHeading()).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("edits a declaration from the predio's ficha in the full dj", async () => {
    start('/predios/p1?tab=declaraciones')
    const lapiz = await screen.findByRole('link', { name: `Editar declaración ${year}` })
    expect(lapiz).toHaveAttribute('href', '/declaraciones/d1')
    await userEvent.click(lapiz)
    expect(await djHeading()).toBeInTheDocument()
  })

  it("reaches a predio's características, niveles and obras from the contribuyente in two clicks", async () => {
    start('/contribuyentes/c1')
    await userEvent.click(await screen.findByRole('tab', { name: 'Predios' }))
    await userEvent.click(await screen.findByRole('link', { name: '39147' }))
    expect(await djHeading()).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Características' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Listado de niveles de construcción')).toBeInTheDocument()
    expect(screen.getByText('Listado de obras complementarias')).toBeInTheDocument()
  })

  it("reaches a titular's características from the predio in two clicks", async () => {
    start('/predios/p1')
    await userEvent.click(await screen.findByRole('tab', { name: 'Titulares' }))
    await userEvent.click(await screen.findByRole('link', { name: '39147' }))
    expect(await djHeading()).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Características' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Listado de niveles de construcción')).toBeInTheDocument()
  })

  it('presents a new declaration from the predio in the wizard, with the predio fixed and the contribuyente looked up', async () => {
    start('/predios/p1?tab=declaraciones', [
      // no titular yet this year: one would be joined as a condómino instead (grisObligatorio.test.tsx)
      { path: '/srtm/predios/p1/declaraciones', body: [] },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva declaración' }))
    expect(await screen.findByRole('heading', { name: 'Nueva declaración jurada predial' })).toBeInTheDocument()
    // the predio is known: its code, registration and tipo show in datos del predio
    expect(await screen.findByLabelText('Código de predio')).toHaveValue('01-01-0001')
    expect(screen.getByLabelText('Número de registro de predio')).toHaveValue('5243')
    expect(screen.getByLabelText(/Tipo de predio/)).toHaveValue('PREDIO RUSTICO')

    await screen.findByRole('option', { name: 'HERENCIA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'HERENCIA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2020-01-15')
    await userEvent.type(screen.getByLabelText(/Folios/), '4')
    await userEvent.click(screen.getByRole('checkbox', { name: 'DECLARATORIA DE HEREDEROS' }))
    // no contribuyente yet: the wizard does not move on
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Elige el contribuyente')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datos de la ubicación' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Contribuyente/), 'quispe')
    await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/La declaración será sobre el predio/)).toHaveTextContent('01-01-0001')
    // the predio came with the wizard: no other one to register instead
    expect(screen.queryByRole('button', { name: 'Registrar un predio nuevo' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/declaraciones-juradas')
    expect(post.body).toMatchObject({
      predio_id: 'p1',
      declaracion: { tipo_adquisicion: 'HERENCIA', folios: 4, documentos_sustento: 'DECLARATORIA DE HEREDEROS' }
    })
    expect(post.body).not.toHaveProperty('predio')
    expect((post.body as { declaracion: object }).declaracion).not.toHaveProperty('codigo_predio')
    expect(await djHeading()).toBeInTheDocument()
    // the short form's endpoint is gone from the portal
    expect(fetch!.calls.some((c) => c.method === 'POST' && c.path === '/srtm/declaraciones')).toBe(false)
  })

  it('edits the valores of a declaration in its características, over the declaration as it is now', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [{ method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion }])
    const panel = within(await screen.findByRole('tabpanel'))
    expect(await panel.findByRole('group', { name: 'Valores' })).toBeInTheDocument()
    await userEvent.clear(panel.getByLabelText('Autoavalúo (S/)'))
    await userEvent.type(panel.getByLabelText('Autoavalúo (S/)'), '25000.50')
    await userEvent.type(panel.getByLabelText('Deducción (S/)'), '1500')
    await userEvent.clear(panel.getByLabelText('Valor afecto (S/)'))
    await userEvent.type(panel.getByLabelText('Valor afecto (S/)'), '23500.5')
    await userEvent.clear(panel.getByLabelText('Área construida (m2)'))
    await userEvent.type(panel.getByLabelText('Área construida (m2)'), '150')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    const put = await called((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')
    expect(put.body).toMatchObject({
      valor_autoavaluo: 25000.5,
      valor_condominio: null,
      deduccion: 1500,
      valor_afecto: 23500.5,
      area_construida: 150,
      // the other tabs' fields ride along as stored
      numero_declaracion: 39147,
      tipo_adquisicion: 'COMPRA',
      folios: 2
    })
  })

  // wasichai/srtm-ui#94: the DJ exige frontis y área construida solo cuando la ordenanza vigente cobra por esa base
  it('asks for frontis and área construida once the year charges arbitrios by that base, optional until then', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [
      {
        path: '/srtm/arbitrios/parametros',
        body: {
          anio: year,
          ordenanza: null,
          servicios: [],
          parametros: [filaBase('LIMPIEZA', 'FRONTIS_ML'), filaBase('PARQUES', 'AREA_CONSTRUIDA_M2')],
          faltan: []
        }
      }
    ])
    const panel = within(await screen.findByRole('tabpanel'))
    await panel.findByRole('group', { name: 'Valores' })
    // the year's ordenanza cobra por FRONTIS_ML and AREA_CONSTRUIDA_M2: both become required (compatibility with a
    // year that lacks those filas, or a parámetros query that fails, stays optional: the unmodified test above,
    // which mocks no /srtm/arbitrios/parametros route at all, still saves área construida without it)
    await waitFor(() => expect(screen.getByText(/^Frontis \(m\)/).textContent).toContain('*'))
    expect(screen.getByText(/^Área construida/).textContent).toContain('*')
  })

  // wasichai/srtm-ui#94: once required, an empty frontis keeps the DJ from being saved, and nothing is sent; typed,
  // it goes with the rest. a form not touched is not validated (the kit's way): the clerk changes a value first
  it('does not save a DJ whose frontis the year requires and is empty, and saves it once typed', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [
      { method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion },
      { path: '/srtm/arbitrios/parametros', body: { anio: year, ordenanza: null, servicios: [], parametros: [filaBase('LIMPIEZA', 'FRONTIS_ML')], faltan: [] } }
    ])
    const panel = within(await screen.findByRole('tabpanel'))
    await panel.findByRole('group', { name: 'Valores' })
    await waitFor(() => expect(screen.getByText(/^Frontis \(m\)/).textContent).toContain('*'))
    await userEvent.clear(panel.getByLabelText('Autoavalúo (S/)'))
    await userEvent.type(panel.getByLabelText('Autoavalúo (S/)'), '25000.50')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await panel.findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)

    await userEvent.type(panel.getByLabelText(/^Frontis \(m\)/), '10.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const put = await called((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')
    expect(put.body).toMatchObject({ longitud_frente: 10.5, valor_autoavaluo: 25000.5 })
  })

  // wasichai/srtm-ui#94: el asistente, tras presentar, debe saltar a «Características» cuando le falta frontis y
  // el año cobra por FRONTIS_ML - no a «Transferentes», como si nada faltara
  it('sends a freshly presented DJ to «Características» when the year charges by FRONTIS_ML and it is empty', async () => {
    const djNueva = {
      declaracion: {
        id: 'd9',
        contribuyente: 'c1',
        predio: 'p1',
        anio: year,
        numero_declaracion: 50000,
        secuencia_uso: '1',
        condicion_propiedad: 'PROPIETARIO UNICO',
        porcentaje_condominio: 100,
        // ni COMPRA ni el resto de CON_TRANSFERENTE: así el salto no se decide antes de mirar características
        tipo_adquisicion: 'OTROS',
        fecha_adquisicion: '2024-09-04',
        folios: 2,
        documentos_sustento: 'OTROS',
        medio_presentacion: 'FISICO',
        fecha_presentacion: '2026-09-24',
        // lo demás que características exige, ya puesto; falta longitud_frente
        clase_uso: 'RESIDENCIAL',
        sub_clase_uso: 'UNIFAMILIAR',
        uso: 'CASA HABITACION',
        area_terreno: 120
      },
      predio,
      contribuyente,
      actualizado: null
    }
    start('/predios/p1?tab=declaraciones', [
      { path: '/srtm/predios/p1/declaraciones', body: [] },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: djNueva },
      { path: '/srtm/declaraciones/d9', body: djNueva },
      { path: '/srtm/declaraciones/d9/transferentes', body: [] },
      { path: '/srtm/declaraciones/d9/niveles', body: [] },
      { path: '/srtm/declaraciones/d9/obras', body: [] },
      { path: '/srtm/declaraciones/d9/frentes', body: [] },
      { path: '/srtm/arbitrios/parametros', body: { anio: year, ordenanza: null, servicios: [], parametros: [filaBase('LIMPIEZA', 'FRONTIS_ML')], faltan: [] } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva declaración' }))
    await screen.findByRole('option', { name: 'HERENCIA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'HERENCIA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2020-01-15')
    await userEvent.type(screen.getByLabelText(/Folios/), '4')
    await userEvent.click(screen.getByRole('checkbox', { name: 'DECLARATORIA DE HEREDEROS' }))
    await userEvent.type(screen.getByLabelText(/Contribuyente/), 'quispe')
    await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('tab', { name: 'Datos de la ubicación' })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 50000' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Características' })).toHaveAttribute('aria-selected', 'true'))
  })

  // wasichai/srtm-ui#94: si el clerk cambia el año antes de presentar, las bases que cuentan son las
  // del año presentado - no las del año por defecto con el que arrancó el formulario (año A, sin bases) ni
  // ninguna que haya quedado en caché de él
  it("uses the presented año's bases, not the default año's, when the clerk changes it before presenting", async () => {
    const anioB = year + 3
    const djAnioB = {
      declaracion: {
        id: 'd10',
        contribuyente: 'c1',
        predio: 'p1',
        anio: anioB,
        numero_declaracion: 50010,
        secuencia_uso: '1',
        condicion_propiedad: 'PROPIETARIO UNICO',
        porcentaje_condominio: 100,
        tipo_adquisicion: 'OTROS',
        fecha_adquisicion: '2024-09-04',
        folios: 2,
        documentos_sustento: 'OTROS',
        medio_presentacion: 'FISICO',
        fecha_presentacion: '2026-09-24',
        clase_uso: 'RESIDENCIAL',
        sub_clase_uso: 'UNIFAMILIAR',
        uso: 'CASA HABITACION',
        area_terreno: 120
      },
      predio,
      contribuyente,
      actualizado: null
    }
    start('/predios/p1?tab=declaraciones', [
      { path: '/srtm/predios/p1/declaraciones', body: [] },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: djAnioB },
      { path: '/srtm/declaraciones/d10', body: djAnioB },
      { path: '/srtm/declaraciones/d10/transferentes', body: [] },
      { path: '/srtm/declaraciones/d10/niveles', body: [] },
      { path: '/srtm/declaraciones/d10/obras', body: [] },
      { path: '/srtm/declaraciones/d10/frentes', body: [] },
      // año A, el que trae el formulario por defecto: sin bases (si el bug volviera, el salto iría a Transferentes)
      { path: new RegExp(`^/srtm/arbitrios/parametros\\?anio=${year}$`), body: { anio: year, ordenanza: null, servicios: [], parametros: [], faltan: [] } },
      // año B, el que se presenta: cobra por FRONTIS_ML
      {
        path: new RegExp(`^/srtm/arbitrios/parametros\\?anio=${anioB}$`),
        body: { anio: anioB, ordenanza: null, servicios: [], parametros: [filaBase('LIMPIEZA', 'FRONTIS_ML')], faltan: [] }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva declaración' }))
    await screen.findByRole('option', { name: 'HERENCIA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'HERENCIA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2020-01-15')
    await userEvent.type(screen.getByLabelText(/Folios/), '4')
    await userEvent.click(screen.getByRole('checkbox', { name: 'DECLARATORIA DE HEREDEROS' }))
    // cambia el año antes de seguir: lo presentado será el año B, no el A con el que arrancó el formulario
    await userEvent.clear(screen.getByLabelText(/^Año/))
    await userEvent.type(screen.getByLabelText(/^Año/), String(anioB))
    await userEvent.type(screen.getByLabelText(/Contribuyente/), 'quispe')
    await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('tab', { name: 'Datos de la ubicación' })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 50010' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Características' })).toHaveAttribute('aria-selected', 'true'))
  })
})
