import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { LotesMapProps } from './components/LotesMap'

// the catastro fiscal (pages 13-14): buscar predios, the lote editor, and what a lote picked brings into a predio.
// jsdom has no webgl: the map is a double that lists its lotes and offers the clerk's gestures as buttons
const SQUARE = {
  type: 'Polygon',
  coordinates: [
    [
      [-75.225, -10.948],
      [-75.2245, -10.948],
      [-75.2245, -10.9475],
      [-75.225, -10.948]
    ]
  ]
}
vi.mock('./components/LotesMap', () => ({
  LotesMap: (props: LotesMapProps) => {
    const ids = (props.features?.features ?? []).map((f) => String(f.properties.__id ?? String(f.id ?? '').split(':')[0]))
    return (
      <div data-testid="lotes-map" aria-label={props.label}>
        <span data-testid="lotes">{ids.join(',')}</span>
        <span data-testid="lote-elegido">{props.selectedId ?? ''}</span>
        {props.onSelect &&
          ids.map((id) => (
            <button key={id} type="button" onClick={() => props.onSelect?.(id)}>
              lote {id}
            </button>
          ))}
        {props.draw && (
          <button type="button" onClick={() => props.draw?.onChange(SQUARE)}>
            dibujar cuadrado
          </button>
        )}
      </div>
    )
  }
}))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const page = (content: unknown[]) => ({ content, page: 0, size: 5, totalElements: content.length, totalPages: 1 })

const ubigeos = [
  { codigo: '120301', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'CHANCHAMAYO' },
  { codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' },
  { codigo: '140101', departamento: 'LAMBAYEQUE', provincia: 'CHICLAYO', distrito: 'CHICLAYO' }
]
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
  sector_catastral: '01',
  manzana_catastral: '01',
  condicion: 'URBANO',
  direccion: 'JR. LIMA 123',
  via: 'LIMA',
  numero: '123',
  manzana: null,
  lote: null,
  habilitacion_urbana: null,
  ubicacion_area_verde: null,
  ubigeo: '120302',
  departamento: 'JUNIN',
  provincia: 'CHANCHAMAYO',
  distrito: 'PERENE',
  region: 'SELVA'
}
const lote = {
  id: 'k1',
  codigo_cpu: '54102166-0001-2',
  codigo_predio_municipal: '5243',
  partida_registral: null,
  tipo_predio: 'PREDIO URBANO',
  ubigeo: '140101',
  tipo_via: 'AVENIDA',
  via: 'ANDRES AVELINO CACERES',
  numero: null,
  tipo_zona: 'URBANIZACION',
  zona: 'SOL DE LA ALAMEDA',
  manzana: 'C',
  lote: '19',
  kilometro: null,
  direccion: 'AV. ANDRES AVELINO CACERES URB. SOL DE LA ALAMEDA MZ. C LOT. 19',
  lote_geom: SQUARE
}
const dj = {
  declaracion: { id: 'd1', contribuyente: 'c1', predio: 'p9', anio: year, numero_declaracion: 39150 },
  predio: { ...predio, id: 'p9', codigo: '5243' },
  contribuyente,
  actualizado: null
}

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 1, predios: 1, declaraciones: 1 } },
  {
    path: '/srtm/catalogos',
    body: {
      predio: {
        condicion: ['URBANO', 'RUSTICO'],
        region: ['COSTA', 'SIERRA', 'SELVA'],
        tipo_via: ['AVENIDA', 'CALLE'],
        tipo_zona: ['URBANIZACION', 'CERCADO']
      },
      declaracion_predial: {
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        tipo_adquisicion: ['COMPRA', 'HERENCIA'],
        condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO']
      },
      catastro_fiscal: {
        tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
        tipo_via: ['AVENIDA', 'CALLE'],
        tipo_zona: ['URBANIZACION', 'CERCADO']
      }
    }
  },
  { path: '/srtm/ubigeos', body: ubigeos },
  { path: '/srtm/vias', body: page([]) },
  { path: '/srtm/unidades-urbanas', body: page([]) },
  { path: /^\/gis\/objects\//, body: { type: 'FeatureCollection', features: [] } },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 0, totales: { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 } } },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 0, totales: { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 } } },
  { path: '/srtm/predios/p1/declaraciones', body: [] },
  { path: '/srtm/predios', body: page([predio]) }
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

const lastCall = (method: string, path: string) =>
  waitFor(() => {
    const call = fetch!.calls.filter((c) => c.method === method && c.path === path).at(-1)
    expect(call).toBeDefined()
    return call!
  })

describe('catastro fiscal', () => {
  it('opens buscar predios on the padrón: the catastro may still be empty', async () => {
    start('/predios')
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    expect(within(dialog).getByRole('tab', { name: 'Buscar en Tributario' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' })).toHaveAttribute('aria-selected', 'false')
  })

  it('takes a lote into a new predio: its municipal code shown, and its data greyed until unlocked', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [
      { path: '/srtm/catastro', body: page([lote]) },
      // no predio of the padrón has the lote's code yet
      { path: '/srtm/predios/buscar', body: page([]) },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }
    ])
    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await eligeLote()
    // page 14: what came from the catastro is greyed, what it did not bring stays open
    expect(screen.getByLabelText(/Descripción de la vía/)).toBeDisabled()
    expect(screen.getByLabelText(/Descripción de la vía/)).toHaveValue('ANDRES AVELINO CACERES')
    expect(screen.getByLabelText(/Descripción de la zona/)).toBeDisabled()
    expect(screen.getByLabelText('Lote')).toBeDisabled()
    expect(screen.getByLabelText(/^Código CPU/)).toBeDisabled()
    expect(screen.getByLabelText('Número principal')).toBeEnabled()
    // the lote's ubigeo is a code: its departamento, provincia and distrito come from the INEI list
    expect(screen.getByLabelText(/^Departamento/)).toHaveValue('LAMBAYEQUE')
    expect(screen.getByLabelText(/^Departamento/)).toBeDisabled()
    expect(screen.getByLabelText(/^Distrito/)).toHaveValue('CHICLAYO')
    // the lote's municipal code, for the clerk to see: the backend gives the predio its code
    expect(screen.getByLabelText('Código de predio municipal')).toHaveValue('5243')
    // the map shows the lote; it is the catastro's, not drawn here
    expect(screen.queryByRole('button', { name: /Dibujar lote|Editar lote/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))
    expect(screen.getByLabelText(/Descripción de la vía/)).toBeEnabled()
    expect(screen.getByLabelText(/^Departamento/)).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Desbloquear' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Número principal'), '350')
    await userEvent.type(screen.getByLabelText(/^Sector/), '01')
    await userEvent.type(screen.getByLabelText(/Manzana catastral/), '02')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await lastCall('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')
    // no code: the backend finds the lote by its CPU and takes the lote's municipal code
    expect(post.body).toMatchObject({
      predio: {
        codigo: null,
        codigo_cpu: '54102166-0001-2',
        condicion: 'URBANO',
        ubigeo: '140101',
        departamento: 'LAMBAYEQUE',
        provincia: 'CHICLAYO',
        distrito: 'CHICLAYO',
        tipo_via: 'AVENIDA',
        via: 'ANDRES AVELINO CACERES',
        numero: '350',
        habilitacion_urbana: 'SOL DE LA ALAMEDA',
        manzana: 'C',
        lote: '19',
        lote_geom: SQUARE
      }
    })
  })

  it('sends what a lote filled while it is greyed', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [
      { path: '/srtm/catastro', body: page([{ ...lote, ubigeo: '120302' }]) },
      { path: '/srtm/predios/buscar', body: page([]) },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }
    ])
    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await eligeLote()
    await userEvent.type(screen.getByLabelText(/^Sector/), '01')
    await userEvent.type(screen.getByLabelText(/Manzana catastral/), '02')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await lastCall('POST', '/srtm/contribuyentes/c1/declaraciones-juradas')
    expect(post.body).toMatchObject({
      predio: { codigo: null, distrito: 'PERENE', via: 'ANDRES AVELINO CACERES', manzana: 'C', lote: '19', codigo_cpu: '54102166-0001-2' }
    })
  })

  it('keeps the code of a predio already in the padrón when a lote is taken into its ubicación', async () => {
    start('/predios/p1', [
      { path: '/srtm/catastro', body: page([lote]) },
      { path: '/srtm/predios/buscar', body: page([]) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    await eligeLote()
    expect(screen.getByLabelText(/Descripción de la vía/)).toHaveValue('ANDRES AVELINO CACERES')
    expect(screen.getByLabelText('Código de predio municipal')).toHaveValue('01-01-0001')
  })
})

describe('nuevo predio from a lote', () => {
  it("places it where the lote's ubigeo says, not in Perené", async () => {
    start('/predios', [
      { path: '/srtm/catastro', body: page([lote]) },
      { path: '/srtm/predios/buscar', body: page([]) },
      { method: 'POST', path: '/srtm/predios', status: 201, body: { ...predio, id: 'p9' } }
    ])
    await eligeLote()
    expect(await screen.findByRole('heading', { name: 'Nuevo predio' })).toBeInTheDocument()
    expect(await screen.findByLabelText(/^Departamento/)).toHaveValue('LAMBAYEQUE')
    expect(screen.getByLabelText(/^Provincia/)).toHaveValue('CHICLAYO')
    expect(screen.getByLabelText(/^Distrito/)).toHaveValue('CHICLAYO')
    expect(screen.getByLabelText(/^Distrito/)).toBeDisabled()
    expect(screen.getByLabelText(/Descripción de la vía/)).toBeDisabled()
    expect(screen.getByLabelText('Código de predio municipal')).toHaveValue('5243')
    // Perené's región is not the lote's
    expect(screen.getByLabelText(/Región/)).toHaveValue('')
    await userEvent.selectOptions(screen.getByLabelText(/Región/), 'COSTA')
    await userEvent.type(screen.getByLabelText(/^Sector/), '01')
    await userEvent.type(screen.getByLabelText(/Manzana catastral/), '02')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar predio' }))

    const post = await lastCall('POST', '/srtm/predios')
    // no code: the backend finds the lote by its CPU and takes the lote's municipal code
    expect(post.body).toMatchObject({
      codigo: null,
      ubigeo: '140101',
      departamento: 'LAMBAYEQUE',
      provincia: 'CHICLAYO',
      distrito: 'CHICLAYO',
      region: 'COSTA',
      via: 'ANDRES AVELINO CACERES',
      codigo_cpu: '54102166-0001-2',
      lote_geom: SQUARE
    })
  })
})

describe('lotes from buscar predios', () => {
  it('opens the lote editor from the catastro tab: a new lote, or the one picked', async () => {
    start('/predios', [
      { path: '/srtm/catastro', body: page([lote]) },
      { path: '/srtm/catastro/k1', body: lote }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    let dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    // the padrón has no lotes to keep
    expect(within(dialog).queryByRole('link', { name: 'Nuevo lote' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' }))
    await userEvent.click(within(dialog).getByRole('link', { name: 'Nuevo lote' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo lote de catastro fiscal' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' }))
    expect(within(dialog).queryByRole('link', { name: 'Editar lote' })).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Código CPU'), '54102166')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
    await userEvent.click(await within(dialog).findByRole('cell', { name: '54102166-0001-2' }))
    await userEvent.click(within(dialog).getByRole('link', { name: 'Editar lote' }))
    expect(await screen.findByRole('heading', { name: 'Lote 54102166-0001-2' })).toBeInTheDocument()
  })

  it('opens the lote editor in another browser tab from a form being filled, so nothing typed is lost', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [{ path: '/srtm/catastro', body: page([lote]) }])
    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' }))
    const nuevo = within(dialog).getByRole('link', { name: 'Nuevo lote' })
    expect(nuevo).toHaveAttribute('href', '/catastro/nuevo')
    expect(nuevo).toHaveAttribute('target', '_blank')
    await userEvent.type(within(dialog).getByLabelText('Código CPU'), '54102166')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
    await userEvent.click(await within(dialog).findByRole('cell', { name: '54102166-0001-2' }))
    expect(within(dialog).getByRole('link', { name: 'Editar lote' })).toHaveAttribute('href', '/catastro/k1')
    expect(within(dialog).getByRole('link', { name: 'Editar lote' })).toHaveAttribute('target', '_blank')
  })
})

describe('lote editor', () => {
  it('registers a lote of the catastro with the polygon drawn on the map', async () => {
    const nuevo = { ...lote, id: 'k2', codigo_cpu: '54102170-0001-9', codigo_predio_municipal: null, ubigeo: '120302' }
    start('/', [
      { method: 'POST', path: '/srtm/catastro', status: 201, body: nuevo },
      { path: '/srtm/catastro/k2', body: nuevo }
    ])
    await userEvent.click(await screen.findByRole('link', { name: 'Nuevo lote de catastro' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo lote de catastro fiscal' })).toBeInTheDocument()
    // Perené, where the padrón is, until another place is picked
    expect(await screen.findByLabelText(/^Distrito/)).toHaveValue('PERENE')
    await userEvent.type(screen.getByLabelText(/Código CPU/), '54102170-0001-9')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de vía/), 'AVENIDA')
    await userEvent.type(screen.getByLabelText(/Descripción de la vía/), 'ANDRES AVELINO CACERES')
    await userEvent.type(screen.getByLabelText('Manzana'), 'C')
    await userEvent.type(screen.getByLabelText('Lote'), '23')
    await userEvent.click(screen.getByRole('button', { name: 'Dibujar lote' }))
    await userEvent.click(screen.getByRole('button', { name: 'dibujar cuadrado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(screen.getByTestId('lote-elegido')).toHaveTextContent('lote-del-predio')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar lote' }))

    const post = await lastCall('POST', '/srtm/catastro')
    expect(post.body).toMatchObject({
      codigo_cpu: '54102170-0001-9',
      tipo_predio: 'PREDIO URBANO',
      ubigeo: '120302',
      tipo_via: 'AVENIDA',
      via: 'ANDRES AVELINO CACERES',
      manzana: 'C',
      lote: '23',
      lote_geom: SQUARE,
      codigo_predio_municipal: null
    })
    // the lote keeps its ubigeo only
    expect(post.body).not.toHaveProperty('distrito')
    // then it is a ficha of its own, in the workspace tabs
    expect(await screen.findByRole('heading', { name: 'Lote 54102170-0001-9' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Fichas abiertas' })).getByRole('link', { name: 'Lote 54102170-0001-9' })).toBeInTheDocument()
  })

  it('edits a lote: its data and its polygon', async () => {
    start('/catastro/k1', [
      { path: '/srtm/catastro/k1', body: lote },
      { method: 'PUT', path: '/srtm/catastro/k1', body: { ...lote, numero: '350' } }
    ])
    expect(await screen.findByRole('heading', { name: 'Lote 54102166-0001-2' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Código CPU/)).toHaveValue('54102166-0001-2')
    expect(await screen.findByLabelText(/^Departamento/)).toHaveValue('LAMBAYEQUE')
    expect(screen.getByLabelText(/^Distrito/)).toHaveValue('CHICLAYO')
    expect(screen.getByTestId('lote-elegido')).toHaveTextContent('lote-del-predio')
    await userEvent.type(screen.getByLabelText('Número principal'), '350')
    await userEvent.click(screen.getByRole('button', { name: 'Editar lote' }))
    await userEvent.click(screen.getByRole('button', { name: 'dibujar cuadrado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const put = await lastCall('PUT', '/srtm/catastro/k1')
    expect(put.body).toMatchObject({
      codigo_cpu: '54102166-0001-2',
      codigo_predio_municipal: '5243',
      ubigeo: '140101',
      numero: '350',
      via: 'ANDRES AVELINO CACERES',
      zona: 'SOL DE LA ALAMEDA',
      direccion: lote.direccion,
      lote_geom: SQUARE
    })
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
  })
})

// "buscar predios", in the catastro fiscal: the lote 54102166-0001-2
async function eligeLote() {
  await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
  const dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
  await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' }))
  await userEvent.type(within(dialog).getByLabelText('Código CPU'), '54102166')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
  await userEvent.click(await within(dialog).findByRole('cell', { name: '54102166-0001-2' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Elegir' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}
