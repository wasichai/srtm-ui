import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// the srtm's flow of a declaración jurada (pp. 11-21, issue #11): the wizard walks every tab, the form tabs are edited
// in place, and the header's Cancelar / Guardar take the pending changes of all of them

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
const predio = { id: 'p1', codigo: '01-01-0001', numero_registro: 5243, condicion: 'URBANO', direccion: 'JR. LIMA 123', region: 'SELVA' }
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  numero_declaracion: 39147,
  secuencia_uso: '001',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACION',
  area_terreno: 120,
  valor_autoavaluo: 10080.45,
  tipo_adquisicion: 'COMPRA',
  fecha_adquisicion: '2024-09-04',
  folios: 2,
  documentos_sustento: 'MINUTA',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24',
  otros_datos: null
}
const dj = { declaracion, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' }
// what "Siguiente" on the wizard's ubicación presents: a new predio, a declaration with no características yet
const predioNuevo = { ...predio, id: 'p9', codigo: 'P-000001', numero_registro: 1, direccion: 'AV. MARGINAL, C.P. UNION PERENE' }
const presentada = {
  ...declaracion,
  id: 'd9',
  predio: 'p9',
  numero_declaracion: 39150,
  clase_uso: null,
  sub_clase_uso: null,
  uso: null,
  area_terreno: null,
  valor_autoavaluo: null
}
const djNueva = { declaracion: presentada, predio: predioNuevo, contribuyente, actualizado: null }
const totales = { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 }
const categorias = [
  { columna: 1, categoria: 'MUROS Y COLUMNAS', letra: 'C', descripcion: 'PLACAS DE CONCRETO' },
  { columna: 2, categoria: 'TECHOS', letra: 'C', descripcion: 'ALIGERADO O LOSAS DE CONCRETO ARMADO HORIZONTALES' },
  { columna: 4, categoria: 'PUERTAS Y VENTANAS', letra: 'D', descripcion: 'VENTANAS DE ALUMINIO' }
]

const djRoute: MockRoute = { path: '/srtm/declaraciones/d1', body: dj }
const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      predio: { condicion: ['URBANO', 'RUSTICO'], region: ['COSTA', 'SIERRA', 'SELVA'], tipo_via: ['AVENIDA', 'CALLE'], tipo_zona: ['CENTRO POBLADO'] },
      declaracion_predial: {
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        tipo_adquisicion: ['COMPRA', 'HERENCIA', 'PRESCRIPCION ADQUISITIVA'],
        condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO']
      },
      nivel_construccion: { tipo_nivel: ['PISO'], material: ['LADRILLO'], estado_conservacion: ['BUENO'], estado: ['ACTIVO'] },
      obra_complementaria: {
        ingreso: ['POR CATEGORIAS', 'CON VALORIZACION'],
        material: ['LADRILLO'],
        tipo_obra: ['MUROS PERIMETRICOS O CERCOS'],
        estado_conservacion: ['BUENO'],
        unidad_medida: ['M2', 'ML'],
        estado: ['ACTIVO']
      }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  // clase -> sub clase -> uso, chained over the srtm's catalog (issue #13)
  {
    path: '/srtm/usos-predio',
    body: [
      { codigo: '010101', clase: 'RESIDENCIAL', sub_clase: 'UNIFAMILIAR', uso: 'CASA HABITACION' },
      { codigo: '010201', clase: 'RESIDENCIAL', sub_clase: 'MULTIFAMILIAR', uso: 'EDIFICIO' }
    ]
  },
  { path: '/srtm/categorias-valor', body: categorias },
  { path: '/srtm/obras-categorias', body: [] },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/contribuyentes/c1/declaraciones', body: [] },
  djRoute,
  { path: /^\/srtm\/declaraciones\/d1\//, body: [] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente }] },
  { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: djNueva },
  { path: '/srtm/declaraciones/d9', body: djNueva },
  { path: /^\/srtm\/declaraciones\/d9\//, body: [] },
  { path: '/srtm/predios/p9', body: { predio: predioNuevo, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p9/declaraciones', body: [{ declaracion: presentada, predio: null, contribuyente }] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  djRoute.body = dj
})
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const calls = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path === path)
const tab = (name: string) => screen.getByRole('tab', { name })
const header = () => screen.getByRole('group', { name: 'Acciones de la declaración' })

async function llenarDatosDelPredio(tipoAdquisicion = 'COMPRA') {
  // once the catalog is there. an option shows as the srtm writes it (PRESCRIPCIÓN ADQUISITIVA): chosen by its value
  await screen.findByRole('option', { name: 'COMPRA' })
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), tipoAdquisicion)
  await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
  await userEvent.type(screen.getByLabelText(/Folios/), '2')
  await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
}

async function llenarUbicacion() {
  expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de vía/), 'AVENIDA')
  await userEvent.type(screen.getByLabelText(/Descripción de la vía/), 'MARGINAL')
  await userEvent.type(screen.getByLabelText(/Descripción de la zona/), 'UNION PERENE')
  await userEvent.type(screen.getByLabelText(/Código CPU/), '54102166-0001-2')
}

describe('the wizard of a new declaración jurada', () => {
  it('walks every tab: características, a nivel and an obra before finishing', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [
      { method: 'PUT', path: '/srtm/declaraciones/d9', body: presentada },
      { method: 'POST', path: '/srtm/declaraciones/d9/niveles', status: 201, body: { id: 'n1' } },
      { method: 'POST', path: '/srtm/declaraciones/d9/obras', status: 201, body: { id: 'o1' } }
    ])
    await llenarDatosDelPredio()
    await llenarUbicacion()
    // "Siguiente" presents the declaration: it gets its number and the wizard goes on in it
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })).toBeInTheDocument()
    expect(calls('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')).toHaveLength(1)
    expect(new URLSearchParams(window.location.search).get('asistente')).toBe('1')
    // a purchase has its seller: the transferente is what is pending first
    expect(tab('Datos del transferente')).toHaveAttribute('aria-selected', 'true')
    for (const t of screen.getAllByRole('tab')) expect(t).toBeEnabled()

    // "Siguiente" saves what is pending first: nothing here
    await userEvent.click(within(header()).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(tab('Características')).toHaveAttribute('aria-selected', 'true'))
    const caracteristicas = within(screen.getByRole('tabpanel'))
    await caracteristicas.findByRole('option', { name: 'RESIDENCIAL' })
    await userEvent.selectOptions(caracteristicas.getByLabelText(/^Clase de uso/), 'RESIDENCIAL')
    await userEvent.selectOptions(caracteristicas.getByLabelText(/^Sub clase de uso/), 'UNIFAMILIAR')
    await userEvent.selectOptions(caracteristicas.getByLabelText(/^Uso del predio/), 'CASA HABITACION')
    await userEvent.type(caracteristicas.getByLabelText(/Área del terreno/), '200')

    // a nivel, saved on its own
    await userEvent.click(caracteristicas.getByRole('button', { name: 'Agregar nivel de construcción' }))
    let dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Mes construcción/), '1')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Material predominante/), 'LADRILLO')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Estado de conservación/), 'BUENO')
    await userEvent.type(within(dialog).getByLabelText(/Área construida/), '200')
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Muros y columnas/), 'C')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Techos/), 'C')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Puertas y ventanas/), 'D')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(calls('POST', '/srtm/declaraciones/d9/niveles')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // an obra, saved on its own
    await userEvent.click(caracteristicas.getByRole('button', { name: 'Agregar obra complementaria' }))
    dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Material predominante/), 'LADRILLO')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de obra/), 'MUROS PERIMETRICOS O CERCOS')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Estado de conservación/), 'BUENO')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Mes construcción/), '2')
    await userEvent.type(within(dialog).getByLabelText(/Categoría/), 'MURO DE LADRILLO')
    await userEvent.type(within(dialog).getByLabelText(/Cantidad/), '2')
    await userEvent.type(within(dialog).getByLabelText(/^Metrado/), '50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(calls('POST', '/srtm/declaraciones/d9/obras')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // the características typed before the lists were saved are still there, and "Siguiente" saves them
    expect(caracteristicas.getByLabelText(/Área del terreno/)).toHaveValue('200')
    await userEvent.click(within(header()).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(tab('Datos de los condóminos')).toHaveAttribute('aria-selected', 'true'))
    const puts = calls('PUT', '/srtm/declaraciones/d9')
    expect(puts).toHaveLength(1)
    expect(puts[0].body).toMatchObject({
      clase_uso: 'RESIDENCIAL',
      sub_clase_uso: 'UNIFAMILIAR',
      uso: 'CASA HABITACION',
      area_terreno: 200,
      numero_declaracion: 39150,
      tipo_adquisicion: 'COMPRA'
    })

    await userEvent.click(within(header()).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(tab('Otros frentes')).toHaveAttribute('aria-selected', 'true'))
    // the last tab ends the wizard
    expect(within(header()).queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    await userEvent.click(within(header()).getByRole('button', { name: 'Terminar' }))
    await waitFor(() => expect(within(header()).queryByRole('button', { name: 'Terminar' })).not.toBeInTheDocument())
    expect(new URLSearchParams(window.location.search).has('asistente')).toBe(false)
    expect(tab('Otros frentes')).toHaveAttribute('aria-selected', 'true')
    // the whole wizard, two dialogs included: more than the default 5 s on a busy machine
  }, 20_000)

  it('goes to the características after presenting when the predio came from no one', async () => {
    const prescrita = { ...djNueva, declaracion: { ...presentada, tipo_adquisicion: 'PRESCRIPCION ADQUISITIVA' } }
    start('/contribuyentes/c1/declaraciones/nueva', [
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: prescrita },
      { path: '/srtm/declaraciones/d9', body: prescrita }
    ])
    await llenarDatosDelPredio('PRESCRIPCION ADQUISITIVA')
    await llenarUbicacion()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })).toBeInTheDocument()
    expect(tab('Características')).toHaveAttribute('aria-selected', 'true')
  })

  it('asks before leaving the wizard with what was typed', async () => {
    start('/contribuyentes/c1/declaraciones/nueva')
    await userEvent.type(await screen.findByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('link', { name: 'Contribuyentes' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('heading', { name: 'Nueva declaración jurada predial' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Folios/)).toHaveValue('2')
  })
})

describe('the declaración jurada, edited in place', () => {
  it('saves the changes of two tabs with the header Guardar, over the declaration as it is now', async () => {
    start('/declaraciones/d1', [{ method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion }])
    // no "Editar": the form is there to be typed in
    const otros = await screen.findByLabelText('Otros datos')
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(header()).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await userEvent.type(otros, 'CON RIEGO')

    await userEvent.click(tab('Características'))
    const area = await within(screen.getByRole('tabpanel')).findByLabelText(/Área del terreno/)
    await userEvent.clear(area)
    await userEvent.type(area, '150')
    // meanwhile a condómino joined: the backend derived this declaration's condición and %
    djRoute.body = { ...dj, declaracion: { ...declaracion, condicion_propiedad: 'CONDOMINO', porcentaje_condominio: 60 } }

    await userEvent.click(within(header()).getByRole('button', { name: 'Guardar' }))
    expect(await within(header()).findByText('Cambios guardados')).toBeInTheDocument()
    const puts = calls('PUT', '/srtm/declaraciones/d1')
    expect(puts).toHaveLength(1)
    expect(puts[0].body).toMatchObject({
      otros_datos: 'CON RIEGO',
      area_terreno: 150,
      // what the tabs did not change is the declaration's as it is now, not as it was loaded
      condicion_propiedad: 'CONDOMINO',
      porcentaje_condominio: 60,
      numero_declaracion: 39147,
      tipo_adquisicion: 'COMPRA'
    })
    expect(puts[0].body).not.toHaveProperty('condicion')
    // the tipo de predio did not change: the predio is left alone
    expect(calls('PUT', '/srtm/predios/p1')).toHaveLength(0)
    expect(within(header()).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('shows what the backend refused under its field, in its tab', async () => {
    start('/declaraciones/d1', [
      {
        method: 'PUT',
        path: '/srtm/declaraciones/d1',
        status: 400,
        body: { title: 'Bad Request', detail: 'invalid record', errors: [{ field: 'area_terreno', message: 'debe ser mayor que 0' }] }
      }
    ])
    await userEvent.type(await screen.findByLabelText('Otros datos'), 'CON RIEGO')
    await userEvent.click(tab('Características'))
    const area = await within(screen.getByRole('tabpanel')).findByLabelText(/Área del terreno/)
    await userEvent.clear(area)
    await userEvent.type(area, '0')
    await userEvent.click(tab('Datos del predio'))

    await userEvent.click(within(header()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(tab('Características')).toHaveAttribute('aria-selected', 'true'))
    expect(await screen.findByText('debe ser mayor que 0')).toBeInTheDocument()
    // nothing was lost: both changes are still pending
    expect(within(header()).getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('opens the tab of a field left invalid, and sends nothing', async () => {
    start('/declaraciones/d1')
    await userEvent.clear(await screen.findByLabelText(/Folios/))
    await userEvent.click(tab('Características'))
    const area = await within(screen.getByRole('tabpanel')).findByLabelText(/Área del terreno/)
    await userEvent.clear(area)
    await userEvent.type(area, '150')

    await userEvent.click(within(header()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(tab('Datos del predio')).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByLabelText(/Folios/)).toHaveAttribute('aria-invalid', 'true')
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('asks before Cancelar discards the pending changes', async () => {
    start('/declaraciones/d1')
    const cancelar = () => within(header()).getByRole('button', { name: 'Cancelar' })
    const otros = await screen.findByLabelText('Otros datos')
    expect(cancelar()).toBeDisabled()
    await userEvent.type(otros, 'CON RIEGO')

    await userEvent.click(cancelar())
    let dialog = await screen.findByRole('dialog', { name: '¿Descartar los cambios?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByLabelText('Otros datos')).toHaveValue('CON RIEGO')

    await userEvent.click(cancelar())
    dialog = await screen.findByRole('dialog', { name: '¿Descartar los cambios?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Descartar cambios' }))
    await waitFor(() => expect(screen.getByLabelText('Otros datos')).toHaveValue(''))
    expect(cancelar()).toBeDisabled()
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('asks before leaving it with changes, and not when moving between its tabs', async () => {
    start('/declaraciones/d1')
    await userEvent.type(await screen.findByLabelText('Otros datos'), 'CON RIEGO')
    await userEvent.click(tab('Características'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const contribuyenteLink = () => screen.getByRole('link', { name: 'Contribuyente Nº 000012 - QUISPE MAMANI JUAN' })
    await userEvent.click(contribuyenteLink())
    let dialog = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })
    expect(dialog).toHaveTextContent('Datos del predio')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('heading', { name: 'Declaración jurada predial - 39147' })).toBeInTheDocument()

    await userEvent.click(contribuyenteLink())
    dialog = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salir sin guardar' }))
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
  })

  it('keeps its workspace tab when closing it is not confirmed', async () => {
    start('/declaraciones/d1')
    const tabBar = () => screen.getByRole('navigation', { name: 'Fichas abiertas' })
    await userEvent.type(await screen.findByLabelText('Otros datos'), 'CON RIEGO')
    await userEvent.click(await within(tabBar()).findByRole('button', { name: 'Cerrar DJ 39147 01-01-0001' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(within(tabBar()).getByRole('link', { name: 'DJ 39147 01-01-0001' })).toBeInTheDocument()
    expect(screen.getByLabelText('Otros datos')).toHaveValue('CON RIEGO')

    await userEvent.click(within(tabBar()).getByRole('button', { name: 'Cerrar DJ 39147 01-01-0001' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salir sin guardar' }))
    await waitFor(() => expect(within(tabBar()).queryByRole('link', { name: 'DJ 39147 01-01-0001' })).not.toBeInTheDocument())
  })
})
