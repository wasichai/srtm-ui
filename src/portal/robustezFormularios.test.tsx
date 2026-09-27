import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute, type RecordedCall } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { formatDate } from './components/format'
import { esPersonaNatural } from './forms/specs'

// the forms' robustness (issue #18): what the backend refuses of a field with no input, the fields a parent greys,
// sucesiones, instants in Perú's time, the wizard's errors, and the tipo de predio shared by two tabs

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
  apellido_paterno: 'QUISPE',
  apellido_materno: 'MAMANI',
  nombres: 'JUAN',
  codigo: '000012',
  tipo_contribuyente: 'PERSONA NATURAL',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24',
  fuente_informacion: 'MANUAL',
  estado_civil: 'SOLTERO',
  sexo: 'HOMBRE'
}
// a predio whose ubicación is complete: saving its tab validates it
const predio = {
  id: 'p1',
  codigo: '01-01-0001',
  numero_registro: 5243,
  condicion: 'URBANO',
  direccion: 'AV. MARGINAL, C.P. UNION PERENE',
  ubigeo: '120302',
  departamento: 'JUNIN',
  provincia: 'CHANCHAMAYO',
  distrito: 'PERENE',
  region: 'SELVA',
  tipo_via: 'AVENIDA',
  via: 'MARGINAL',
  tipo_zona: 'CENTRO POBLADO',
  habilitacion_urbana: 'UNION PERENE'
}
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
  tipo_adquisicion: 'COMPRA',
  fecha_adquisicion: '2024-09-04',
  folios: 2,
  documentos_sustento: 'MINUTA',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24'
}
// saved at 22:30 in Perú, already the next day in UTC
const dj = { declaracion, predio, contribuyente, actualizado: '2026-09-26T03:30:00Z' }
const presentada = { ...declaracion, id: 'd9', numero_declaracion: 39150, clase_uso: null, sub_clase_uso: null, uso: null, area_terreno: null }
const djNueva = { declaracion: presentada, predio, contribuyente, actualizado: null }
const totales = { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 }
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const rechazo = (field: string, message: string) => ({ title: 'Bad Request', detail: 'invalid record', errors: [{ field, message }] })

const djRoute: MockRoute = { path: '/srtm/declaraciones/d1', body: dj }
const contribuyenteRoute: MockRoute = { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } }
const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      contribuyente: {
        tipo_documento: ['SIN DOCUMENTO', 'DNI', 'RUC'],
        tipo_contribuyente: ['PERSONA NATURAL', 'PERSONA JURIDICA', 'SUCESION INDIVISA'],
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        fuente_informacion: ['MANUAL', 'PIDE RENIEC'],
        estado_civil: ['SOLTERO', 'CASADO'],
        sexo: ['HOMBRE', 'MUJER']
      },
      predio: { condicion: ['URBANO', 'RUSTICO'], region: ['COSTA', 'SIERRA', 'SELVA'], tipo_via: ['AVENIDA', 'CALLE'], tipo_zona: ['CENTRO POBLADO'] },
      declaracion_predial: {
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        tipo_adquisicion: ['COMPRA', 'HERENCIA'],
        condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO'],
        condicion_especial: ['PENSIONISTA', 'INAFECTO'],
        condicion_tipo_documento: ['RESOLUCION']
      }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }] },
  { path: '/srtm/usos-predio', body: [{ codigo: '010101', clase: 'RESIDENCIAL', sub_clase: 'UNIFAMILIAR', uso: 'CASA HABITACION' }] },
  { path: '/srtm/vias', body: page([]) },
  { path: '/srtm/unidades-urbanas', body: page([]) },
  { path: '/srtm/contribuyentes', body: page([contribuyente]) },
  contribuyenteRoute,
  { path: /^\/srtm\/contribuyentes\/c1\//, body: [] },
  djRoute,
  { path: /^\/srtm\/declaraciones\/d1\//, body: [] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente }] },
  { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: djNueva },
  { path: '/srtm/declaraciones/d9', body: djNueva },
  { path: /^\/srtm\/declaraciones\/d9\//, body: [] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  djRoute.body = dj
  contribuyenteRoute.body = { contribuyente, anio: year, predios: 1, totales }
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
const called = (method: string, path: string) =>
  waitFor(() => {
    const call = calls(method, path)[0]
    expect(call).toBeDefined()
    return call as RecordedCall
  })
const tab = (name: string) => screen.getByRole('tab', { name })
// the tab shown: the other form tabs stay mounted, hidden, with labels of their own
const panel = () => within(screen.getByRole('tabpanel'))
// the same, once the page is there
const abierto = async () => within(await screen.findByRole('tabpanel'))
const header = () => screen.getByRole('group', { name: 'Acciones de la declaración' })
const guardar = () => userEvent.click(within(header()).getByRole('button', { name: 'Guardar' }))
const siguiente = () => userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

async function llenarDatosDelPredio() {
  await (await abierto()).findByRole('option', { name: 'COMPRA' })
  await userEvent.selectOptions(panel().getByLabelText(/Tipo de adquisición/), 'COMPRA')
  await userEvent.type(panel().getByLabelText(/Fecha de adquisición/), '2024-09-04')
  await userEvent.type(panel().getByLabelText(/Folios/), '2')
  await userEvent.click(panel().getByRole('checkbox', { name: 'MINUTA' }))
  await siguiente()
}

async function llenarUbicacion() {
  await waitFor(() => expect(tab('Datos de la ubicación')).toHaveAttribute('aria-selected', 'true'))
  await userEvent.selectOptions(panel().getByLabelText(/Tipo de vía/), 'AVENIDA')
  await userEvent.type(panel().getByLabelText(/Descripción de la vía/), 'MARGINAL')
  await userEvent.type(panel().getByLabelText(/Descripción de la zona/), 'UNION PERENE')
}

describe('a refusal of the backend on a field with no input of its own', () => {
  it('shows above the ubicación what was refused of its lote, drawn on the map', async () => {
    start('/declaraciones/d1?tab=ubicacion', [
      {
        method: 'PUT',
        path: '/srtm/predios/p1',
        status: 400,
        body: {
          title: 'Bad Request',
          detail: 'invalid record',
          errors: [
            { field: 'lote_geom', message: 'se cruza con el lote 01-01-0002' },
            { field: 'departamento', message: 'no es del padrón' }
          ]
        }
      }
    ])
    await userEvent.type(await (await abierto()).findByLabelText('Referencia'), 'FRENTE AL RIO')
    await guardar()

    const alerta = await panel().findByRole('alert')
    expect(alerta).toHaveTextContent('Lote: se cruza con el lote 01-01-0002')
    expect(tab('Datos de la ubicación')).toHaveAttribute('aria-selected', 'true')
    // a hidden field a custom control shows (the ubigeo's cascade) keeps its message there
    expect(alerta).not.toHaveTextContent('no es del padrón')
    expect(panel().getByLabelText(/^Departamento/)).toHaveAttribute('aria-invalid', 'true')
    expect(panel().getByText('no es del padrón')).toBeInTheDocument()
    // it was about this tab: the header has nothing to add
    expect(within(header()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps under its field what has one', async () => {
    start('/contribuyentes/c1', [
      {
        method: 'PUT',
        path: '/srtm/contribuyentes/c1',
        status: 400,
        body: {
          title: 'Bad Request',
          detail: 'invalid record',
          errors: [
            { field: 'nombres', message: 'no coincide con RENIEC' },
            { field: 'nombre_completo', message: 'ya lo tiene otro contribuyente' }
          ]
        }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Nombre completo: ya lo tiene otro contribuyente')
    expect(alerta).not.toHaveTextContent('no coincide con RENIEC')
    expect(screen.getByLabelText(/^Nombres/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('no coincide con RENIEC')).toBeInTheDocument()
  })
})

describe('a field greyed by the one it depends on', () => {
  it('is sent empty: the condición del predio taken away clears its documents', async () => {
    djRoute.body = {
      ...dj,
      declaracion: {
        ...declaracion,
        condicion_especial: 'INAFECTO',
        condicion_tipo_documento: 'RESOLUCION',
        condicion_numero_documento: 'R-12',
        condicion_fecha_documento: '2025-01-10',
        condicion_fecha_inicio: '2025-01-10'
      }
    }
    start('/declaraciones/d1', [{ method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion }])
    const condicion = await (await abierto()).findByLabelText('Condición del predio')
    await panel().findByRole('option', { name: 'INAFECTO' })
    expect(panel().getByLabelText('Número de documento de sustento')).toHaveValue('R-12')
    await userEvent.selectOptions(condicion, '')
    expect(panel().getByLabelText('Número de documento de sustento')).toBeDisabled()
    await guardar()

    const put = await called('PUT', '/srtm/declaraciones/d1')
    expect(put.body).toMatchObject({
      condicion_especial: null,
      condicion_tipo_documento: null,
      condicion_numero_documento: null,
      condicion_fecha_documento: null,
      condicion_fecha_inicio: null,
      folios: 2
    })
  })

  it('is sent empty from a form saved by its own button: no number for SIN DOCUMENTO', async () => {
    start('/contribuyentes/c1', [{ method: 'PUT', path: '/srtm/contribuyentes/c1', body: contribuyente }])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    await screen.findByRole('option', { name: 'SIN DOCUMENTO' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'SIN DOCUMENTO')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const put = await called('PUT', '/srtm/contribuyentes/c1')
    expect(put.body).toMatchObject({ tipo_documento: 'SIN DOCUMENTO', numero_documento: null })
  })

  it('shows nothing in the ficha while greyed', async () => {
    const anulada = { ...declaracion, estado: 'ANULADA', condicion_especial: null, condicion_numero_documento: 'R-12' }
    djRoute.body = { ...dj, declaracion: anulada }
    start('/declaraciones/d1')
    const dt = await screen.findByText('Número de documento de sustento', { selector: 'dt' })
    expect(dt.nextElementSibling).toHaveTextContent('—')
  })
})

describe('a persona natural', () => {
  it('is told by its tipo de contribuyente, else by its tipo de persona', () => {
    expect(esPersonaNatural({ tipo_contribuyente: 'SUCESION INDIVISA', tipo_persona: 'NATURAL' })).toBe(false)
    expect(esPersonaNatural({ tipo_contribuyente: 'SOCIEDAD CONYUGAL' })).toBe(true)
    expect(esPersonaNatural({ tipo_persona: 'NATURAL' })).toBe(true)
    // an imported sucesión has a razón social
    expect(esPersonaNatural({ tipo_persona: 'SUCESION' })).toBe(false)
    expect(esPersonaNatural({ tipo_persona: 'JURIDICA' })).toBe(false)
    // a new one, before its tipo: names, as the srtm's empty form
    expect(esPersonaNatural({})).toBe(true)
  })

  it('is not an imported sucesión: its razón social shows, in the ficha and in the form', async () => {
    const sucesion = {
      ...contribuyente,
      tipo_persona: 'SUCESION',
      tipo_contribuyente: null,
      tipo_documento: 'SIN DOCUMENTO',
      numero_documento: null,
      apellido_paterno: null,
      apellido_materno: null,
      nombres: null,
      razon_social: 'SUCESION QUISPE MAMANI',
      nombre_completo: 'SUCESION QUISPE MAMANI'
    }
    contribuyenteRoute.body = { contribuyente: sucesion, anio: year, predios: 1, totales }
    start('/contribuyentes/c1')
    const dt = await screen.findByText('Razón social', { selector: 'dt' })
    expect(dt.nextElementSibling).toHaveTextContent('SUCESION QUISPE MAMANI')
    expect(screen.queryByText('Nombres', { selector: 'dt' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText(/Razón social/)).toHaveValue('SUCESION QUISPE MAMANI')
    expect(screen.queryByLabelText(/^Nombres/)).not.toBeInTheDocument()
  })
})

describe('an instant', () => {
  it("is shown on its day in Perú's time", () => {
    expect(formatDate('2026-09-26T03:30:00Z')).toBe('25/09/2026')
    expect(formatDate('2026-09-26T03:30:00.123456Z')).toBe('25/09/2026')
    expect(formatDate('2026-09-25T23:00:00-05:00')).toBe('25/09/2026')
    // a date is a date, wherever it is read
    expect(formatDate('2026-09-26')).toBe('26/09/2026')
  })

  it("dates the declaration's last update in Perú's time", async () => {
    start('/declaraciones/d1')
    expect(await (await abierto()).findByLabelText('Fecha de actualización')).toHaveValue('25/09/2026')
  })
})

describe("the wizard's errors", () => {
  it('go back to the step they are about, under their field', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [
      {
        method: 'POST',
        path: '/srtm/contribuyentes/c1/declaraciones-juradas',
        status: 400,
        body: rechazo('fecha_adquisicion', 'no puede ser posterior a la presentación')
      }
    ])
    await llenarDatosDelPredio()
    await llenarUbicacion()
    await siguiente()

    await waitFor(() => expect(tab('Datos del predio')).toHaveAttribute('aria-selected', 'true'))
    expect(panel().getByLabelText(/Fecha de adquisición/)).toHaveAttribute('aria-invalid', 'true')
    expect(panel().getByText('no puede ser posterior a la presentación')).toBeInTheDocument()
  })

  it('send nothing when datos del predio was left invalid after moving on', async () => {
    start('/contribuyentes/c1/declaraciones/nueva')
    await llenarDatosDelPredio()
    await llenarUbicacion()
    await userEvent.click(tab('Datos del predio'))
    await userEvent.clear(panel().getByLabelText(/Folios/))
    await userEvent.click(tab('Datos de la ubicación'))
    await siguiente()

    await waitFor(() => expect(tab('Datos del predio')).toHaveAttribute('aria-selected', 'true'))
    expect(panel().getByLabelText(/Folios/)).toHaveAttribute('aria-invalid', 'true')
    expect(calls('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')).toHaveLength(0)
  })

  it('cannot come from presenting twice: Siguiente waits for the answer', async () => {
    start('/contribuyentes/c1/declaraciones/nueva')
    await llenarDatosDelPredio()
    await llenarUbicacion()
    // the answer is held until the test lets it go
    let soltar = () => {}
    const respuesta = new Promise<void>((resolve) => (soltar = resolve))
    const mock = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      if (init?.method === 'POST') await respuesta
      return mock(input, init)
    }
    const boton = screen.getByRole('button', { name: 'Siguiente' })
    await userEvent.click(boton)
    await userEvent.click(boton)
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    soltar()

    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })).toBeInTheDocument()
    expect(calls('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')).toHaveLength(1)
  })
})

describe('the secuencia de uso and the tipo de predio', () => {
  it('asks for the secuencia de uso', async () => {
    start('/declaraciones/d1')
    const secuencia = await (await abierto()).findByLabelText(/Secuencia de uso/)
    expect(secuencia.closest('div')!.querySelector('label')).toHaveTextContent('Secuencia de uso *')
    await userEvent.clear(secuencia)
    await guardar()

    await waitFor(() => expect(secuencia).toHaveAttribute('aria-invalid', 'true'))
    expect(calls('PUT', '/srtm/declaraciones/d1')).toHaveLength(0)
  })

  it("takes the wizard's tipo de predio to the ubicación already open, and registers the predio with it", async () => {
    start('/contribuyentes/c1/declaraciones/nueva')
    await llenarDatosDelPredio()
    await llenarUbicacion()
    expect(panel().getByLabelText(/Tipo de predio/)).toHaveValue('URBANO')
    await userEvent.click(tab('Datos del predio'))
    await userEvent.selectOptions(panel().getByLabelText(/Tipo de predio/), 'RUSTICO')
    await userEvent.click(tab('Datos de la ubicación'))
    expect(panel().getByLabelText(/Tipo de predio/)).toHaveValue('RUSTICO')
    await siguiente()

    const post = await called('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')
    expect(post.body).toMatchObject({ predio: { condicion: 'RUSTICO' } })
  })

  it('saves on the predio of the padrón the tipo de predio changed in the wizard', async () => {
    start('/declaraciones/nueva?predio=p1', [{ method: 'PUT', path: '/srtm/predios/p1', body: { ...predio, condicion: 'RUSTICO' } }])
    await userEvent.type(await screen.findByPlaceholderText('DNI, RUC o nombre'), 'QUISPE')
    await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
    await userEvent.selectOptions(panel().getByLabelText(/Tipo de predio/), 'RUSTICO')
    await llenarDatosDelPredio()
    expect(await screen.findByText(/La declaración será sobre el predio/)).toBeInTheDocument()
    const dt = panel().getByText('Tipo de predio', { selector: 'dt' })
    expect(dt.nextElementSibling).toHaveTextContent('PREDIO RÚSTICO')
    await siguiente()

    const put = await called('PUT', '/srtm/predios/p1')
    expect(put.body).toMatchObject({ ...predio, condicion: 'RUSTICO' })
    const post = await called('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')
    expect(post.body).toMatchObject({ predio_id: 'p1' })
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39150' })).toBeInTheDocument()
  })

  it("shows the declaración's tipo de predio as one value in both tabs, and saves it on the predio", async () => {
    start('/declaraciones/d1', [{ method: 'PUT', path: '/srtm/predios/p1', body: { ...predio, condicion: 'RUSTICO' } }])
    await (await abierto()).findByRole('option', { name: 'PREDIO RÚSTICO' })
    await userEvent.selectOptions(panel().getByLabelText(/Tipo de predio/), 'RUSTICO')
    await userEvent.click(tab('Datos de la ubicación'))
    expect(await panel().findByLabelText(/Tipo de predio/)).toHaveValue('RUSTICO')
    await userEvent.selectOptions(panel().getByLabelText(/Tipo de predio/), 'URBANO')
    await userEvent.click(tab('Datos del predio'))
    expect(panel().getByLabelText(/Tipo de predio/)).toHaveValue('URBANO')
    await userEvent.selectOptions(panel().getByLabelText(/Tipo de predio/), 'RUSTICO')
    await guardar()

    expect(await within(header()).findByText('Cambios guardados')).toBeInTheDocument()
    const puts = calls('PUT', '/srtm/predios/p1')
    expect(puts).toHaveLength(1)
    expect(puts[0].body).toMatchObject({ ...predio, condicion: 'RUSTICO' })
    expect(calls('PUT', '/srtm/declaraciones/d1')).toHaveLength(0)
  })

  it("takes the declaración's tipo de predio back to the predio's in both tabs on Cancelar", async () => {
    start('/declaraciones/d1')
    await (await abierto()).findByRole('option', { name: 'PREDIO RÚSTICO' })
    await userEvent.selectOptions(panel().getByLabelText(/Tipo de predio/), 'RUSTICO')
    await userEvent.click(tab('Datos de la ubicación'))
    expect(await panel().findByLabelText(/Tipo de predio/)).toHaveValue('RUSTICO')
    await userEvent.click(within(header()).getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartar cambios' }))

    await waitFor(() => expect(panel().getByLabelText(/Tipo de predio/)).toHaveValue('URBANO'))
    await userEvent.click(tab('Datos del predio'))
    expect(panel().getByLabelText(/Tipo de predio/)).toHaveValue('URBANO')
    expect(within(header()).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
})
