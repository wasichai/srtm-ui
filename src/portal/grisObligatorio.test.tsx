import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordForm } from '../kit/forms/RecordForm'
import { today } from './components/format'
import { DJ_DATOS_SECTIONS, NIVEL_SECTIONS, OBRA_SECTIONS, opcionesDatos, UBICACION_SECTIONS } from './forms/declaracionSpecs'
import { KitDelPortal } from './KitDelPortal'
import { PortalApp } from './PortalApp'

// which fields of the declaración jurada are greyed and which are asked for, as in the srtm (Presentacion2_.pdf,
// pages 11 to 21, and its manual M01-1-014) or as the backend derives them

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const year = new Date().getFullYear()
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => fetch?.restore())

// a form alone, with what its own lookups (vías, ubigeos, categorías) ask for
function conDatos(ui: ReactNode, routes: MockRoute[] = []) {
  fetch = mockFetch([...routes, { path: '/srtm/vias', body: page([]) }, { path: '/srtm/ubigeos', body: [] }])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
    // as the portal sets the kit's forms up: with its labels
    { wrapper: KitDelPortal }
  )
}

// a select's options as [value, what it shows]
const opciones = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => [o.getAttribute('value'), o.textContent])
// a field's label, where its asterisk is
const etiquetaDe = (name: string) => document.querySelector(`label[for="field-${name}"]`)

const catalogos = {
  predio: { tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'] },
  declaracion_predial: {
    medio_presentacion: ['FISICO', 'VIRTUAL'],
    tipo_adquisicion: ['COMPRA'],
    condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO', 'SOCIEDAD CONYUGAL', 'POSEEDOR'],
    inhabitable_tipo_documento: ['RESOLUCION', 'INFORME TECNICO']
  }
}

const datos = {
  tipo_predio: 'PREDIO URBANO',
  medio_determinacion: 'DECLARACION JURADA',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24',
  anio: 2026,
  secuencia_uso: '001',
  tipo_adquisicion: 'COMPRA',
  fecha_adquisicion: '2024-09-04',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: null,
  folios: 2,
  documentos_sustento: 'MINUTA'
}

function datosDelPredio(initial: object, onSubmit = vi.fn(async () => {})) {
  render(<RecordForm sections={DJ_DATOS_SECTIONS} options={opcionesDatos(catalogos)} initial={initial} submitLabel="Grabar" onSubmit={onSubmit} />, {
    wrapper: KitDelPortal
  })
  return onSubmit
}

describe('datos del predio (pages 11 and 12)', () => {
  it('greys the medio and the fecha de presentación: the srtm sets them', () => {
    datosDelPredio(datos)
    expect(screen.getByLabelText(/Medio de presentación/)).toBeDisabled()
    expect(screen.getByLabelText(/Medio de presentación/)).toHaveValue('FÍSICO')
    expect(screen.getByLabelText(/Fecha de presentación/)).toBeDisabled()
    expect(screen.getByLabelText(/Fecha de presentación/)).toHaveValue('24/09/2026')
  })

  it("greys a sole titular's % de propiedad at 100, and offers no CONDÓMINO: the backend derives it", async () => {
    const onSubmit = datosDelPredio(datos)
    expect(opciones(screen.getByLabelText(/Tipo de propiedad/))).toEqual([
      ['', 'SELECCIONAR'],
      ['PROPIETARIO UNICO', 'PROPIETARIO ÚNICO'],
      ['SOCIEDAD CONYUGAL', 'SOCIEDAD CONYUGAL'],
      ['POSEEDOR', 'POSEEDOR']
    ])
    const porcentaje = screen.getByLabelText(/% de propiedad/)
    expect(porcentaje).toBeDisabled()
    expect(porcentaje).toHaveValue('100')
    expect(etiquetaDe('porcentaje_condominio')).not.toHaveTextContent('*')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    // no 100 sent: the backend gives it to a sole titular, and refuses it to one joining a titular
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ condicion_propiedad: 'PROPIETARIO UNICO', porcentaje_condominio: null }))
  })

  it('lets a condómino type its % and asks for it, with its tipo greyed as CONDÓMINO', async () => {
    const onSubmit = datosDelPredio({ ...datos, condicion_propiedad: 'CONDOMINO', porcentaje_condominio: 40 })
    expect(screen.getByLabelText(/Tipo de propiedad/)).toBeDisabled()
    expect(screen.getByLabelText(/Tipo de propiedad/)).toHaveValue('CONDÓMINO')
    const porcentaje = screen.getByLabelText(/% de propiedad/)
    expect(porcentaje).toBeEnabled()
    expect(porcentaje).toHaveValue('40')
    expect(etiquetaDe('porcentaje_condominio')).toHaveTextContent('*')
    await userEvent.clear(porcentaje)
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(await screen.findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.type(porcentaje, '30')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ condicion_propiedad: 'CONDOMINO', porcentaje_condominio: 30 })))
  })

  it('opens the predio inhabitable with its número de resolución: the rest waits for it', async () => {
    datosDelPredio(datos)
    expect(screen.getByLabelText('Número de resolución')).toBeEnabled()
    for (const label of ['Tipo documento', 'Fecha de resolución', 'Fecha de inicio de resolución']) expect(screen.getByLabelText(label)).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Número de resolución'), 'RA-012-2026')
    for (const label of ['Tipo documento', 'Fecha de resolución', 'Fecha de inicio de resolución']) expect(screen.getByLabelText(label)).toBeEnabled()
  })
})

describe('datos de la ubicación (page 14)', () => {
  const ubicacion = {
    ubigeo: '120302',
    departamento: 'JUNIN',
    provincia: 'CHANCHAMAYO',
    distrito: 'PERENE',
    region: 'SELVA',
    tipo_predio: 'PREDIO URBANO',
    tipo_via: null,
    via: 'MARGINAL',
    habilitacion_urbana: 'UNION PERENE',
    codigo_cpu: null
  }
  const ubicacionDe = (initial: object, onSubmit = vi.fn(async () => {})) => {
    conDatos(
      <RecordForm
        sections={UBICACION_SECTIONS}
        options={{ region: ['SELVA'], tipo_via: ['AVENIDA'] }}
        initial={initial}
        submitLabel="Grabar"
        onSubmit={onSubmit}
      />
    )
    return onSubmit
  }

  it('asks a new predio for its código CPU and its tipo de vía, which its dirección is made of', async () => {
    const onSubmit = ubicacionDe(ubicacion)
    expect(etiquetaDe('codigo_cpu')).toHaveTextContent('*')
    expect(etiquetaDe('tipo_via')).toHaveTextContent('*')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(await screen.findAllByText('Este dato es obligatorio')).toHaveLength(2)
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText(/Código CPU/), '54102166-0001-2')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de vía/), 'AVENIDA')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ codigo_cpu: '54102166-0001-2', tipo_via: 'AVENIDA' })))
  })

  it("leaves both optional for a predio of the padrón, which keeps its dirección's text", async () => {
    const onSubmit = ubicacionDe({ ...ubicacion, codigo: '01-01-0001', direccion: 'AV MARGINAL S/N UNION PERENE' })
    expect(etiquetaDe('codigo_cpu')).not.toHaveTextContent('*')
    expect(etiquetaDe('tipo_via')).not.toHaveTextContent('*')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ codigo_cpu: null, tipo_via: null })))
  })
})

describe('a nivel de construcción (page 16)', () => {
  it("greys pisos, revestimientos, baños and instalaciones of this year's construction, as the srtm's manual says", async () => {
    conDatos(
      <RecordForm
        sections={NIVEL_SECTIONS}
        options={{ tipo_nivel: ['PISO'] }}
        initial={{ tipo_nivel: 'PISO', numero_piso: 1, anio_construccion: year }}
        submitLabel="Grabar"
        onSubmit={vi.fn()}
      />,
      [{ path: '/srtm/categorias-valor', body: [] }]
    )
    const greyed = [/^Pisos/, /^Revestimientos/, /^Baños/, /^Instalaciones de E\/S/]
    for (const label of greyed) expect(screen.getByLabelText(label)).toBeDisabled()
    for (const label of [/^Muros y columnas/, /^Techos/, /^Puertas y ventanas/]) expect(screen.getByLabelText(label)).toBeEnabled()
    // the last cuadro of seven columns (letrasCategoria.test.tsx)
    await userEvent.selectOptions(screen.getByLabelText(/Año construcción/), '2022')
    for (const label of greyed) expect(screen.getByLabelText(label)).toBeEnabled()
  })
})

describe('an obra complementaria (pages 18 and 19)', () => {
  it('takes its unidad de medida from the categoría, greyed, and lets it be picked for a categoría typed by hand', async () => {
    conDatos(
      <RecordForm
        sections={OBRA_SECTIONS}
        options={{ ingreso: ['POR CATEGORIAS', 'CON VALORIZACION'], tipo_obra: ['MUROS PERIMETRICOS O CERCOS', 'OTROS'], unidad_medida: ['M2', 'ML'] }}
        initial={{ ingreso: 'POR CATEGORIAS', unidad_medida: 'M2' }}
        submitLabel="Grabar"
        onSubmit={vi.fn()}
      />,
      [
        {
          path: '/srtm/obras-categorias',
          body: [{ tipo_obra: 'MUROS PERIMETRICOS O CERCOS', numero: 3, descripcion: 'MURO DE LADRILLO DE ARCILLA', unidad_medida: 'ML' }]
        }
      ]
    )
    expect(screen.getByLabelText(/Unidad de medida/)).toBeEnabled()
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de obra/), 'MUROS PERIMETRICOS O CERCOS')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: /Categoría/ }), '3. MURO DE LADRILLO DE ARCILLA')
    await waitFor(() => expect(screen.getByLabelText(/Unidad de medida/)).toBeDisabled())
    expect(screen.getByLabelText(/Unidad de medida/)).toHaveValue('ML')
    // nothing in the instructivo for OTROS: the categoría is typed, and so is its unidad
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de obra/), 'OTROS')
    await waitFor(() => expect(screen.getByLabelText(/Unidad de medida/)).toBeEnabled())
  })

  it('sends the unidad de medida its categoría sets: greyed, not emptied as a field another one greys', async () => {
    const onSubmit = vi.fn(async () => {})
    conDatos(
      <RecordForm
        sections={OBRA_SECTIONS}
        options={{
          ingreso: ['POR CATEGORIAS'],
          material: ['LADRILLO'],
          tipo_obra: ['MUROS PERIMETRICOS O CERCOS'],
          estado_conservacion: ['BUENO'],
          unidad_medida: ['M2', 'ML']
        }}
        initial={{
          ingreso: 'POR CATEGORIAS',
          material: 'LADRILLO',
          tipo_obra: 'MUROS PERIMETRICOS O CERCOS',
          estado_conservacion: 'BUENO',
          anio_construccion: 2024,
          mes_construccion: 2,
          numero_piso: 1,
          cantidad: 2,
          metrado: 50
        }}
        submitLabel="Grabar"
        onSubmit={onSubmit}
      />,
      [
        {
          path: '/srtm/obras-categorias',
          body: [{ tipo_obra: 'MUROS PERIMETRICOS O CERCOS', numero: 3, descripcion: 'MURO DE LADRILLO DE ARCILLA', unidad_medida: 'ML' }]
        }
      ]
    )
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: /Categoría/ }), '3. MURO DE LADRILLO DE ARCILLA')
    await waitFor(() => expect(screen.getByLabelText(/Unidad de medida/)).toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoria: '3. MURO DE LADRILLO DE ARCILLA', unidad_medida: 'ML' })))
  })
})

// the portal, for the wizard and the lists

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const contribuyente = { id: 'c1', codigo: '000012', tipo_persona: 'NATURAL', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
const otro = { id: 'c2', codigo: '000013', tipo_persona: 'NATURAL', numero_documento: '43434352', nombre_completo: 'NEIRA CAMPOS DUBERLI' }
const predio = { id: 'p1', codigo: '01-01-0001', numero_registro: 5243, tipo_predio: 'PREDIO URBANO', direccion: 'JR. LIMA 123', region: 'SELVA' }
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  numero_declaracion: 39147,
  secuencia_uso: '001',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  tipo_adquisicion: 'COMPRA',
  fecha_adquisicion: '2024-09-04',
  folios: 2,
  documentos_sustento: 'MINUTA',
  medio_presentacion: 'FISICO',
  fecha_presentacion: '2026-09-24'
}
const dj = { declaracion, predio, contribuyente, actualizado: null }
const totales = { declaraciones: 1, autoavaluo: 0, valor_afecto: 0 }

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      ...catalogos,
      medio_contacto: { tipo: ['TELEFONO CELULAR'] },
      nivel_construccion: { tipo_nivel: ['PISO', 'SOTANO'], material: ['LADRILLO'], estado_conservacion: ['BUENO'], estado: ['ACTIVO', 'INACTIVO'] },
      obra_complementaria: { tipo_obra: ['MUROS PERIMETRICOS O CERCOS'], estado: ['ACTIVO', 'INACTIVO'] },
      otro_frente: { tipo_via: ['AVENIDA'], estado: ['ACTIVO', 'INACTIVO'] }
    }
  },
  { path: '/srtm/ubigeos', body: [] },
  { path: '/srtm/categorias-valor', body: [] },
  { path: '/srtm/obras-categorias', body: [] },
  { path: '/srtm/contribuyentes', body: page([contribuyente]) },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: /^\/srtm\/declaraciones\/d1\/(transferentes|niveles|obras|frentes)$/, body: [] }
]

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

// the wizard from the predio, to the ubicación step: the predio is fixed, the contribuyente looked up
async function hastaLaUbicacion() {
  expect(await screen.findByLabelText('Código de predio')).toHaveValue('01-01-0001')
  await screen.findByRole('option', { name: 'COMPRA' })
  await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
  await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
  await userEvent.type(screen.getByLabelText(/Folios/), '2')
  await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
  await userEvent.type(screen.getByLabelText(/Contribuyente/), 'quispe')
  await userEvent.click(await screen.findByRole('button', { name: '20529936 · QUISPE MAMANI JUAN' }))
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
}

describe('the wizard on a predio of the padrón', () => {
  it('does not present a second titular of the same year: condóminos are added from the declaración that has it', async () => {
    const suya = { ...declaracion, id: 'd2', contribuyente: 'c2', secuencia_uso: '1' }
    start('/declaraciones/nueva?predio=p1', [{ path: '/srtm/predios/p1/declaraciones', body: [{ declaracion: suya, predio: null, contribuyente: otro }] }])
    await hastaLaUbicacion()
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(`El predio ya tiene titular en ${year}`)
    expect(aviso).toHaveTextContent('NEIRA CAMPOS DUBERLI')
    expect(within(aviso).getByRole('link', { name: /Datos de los condóminos/ })).toHaveAttribute('href', '/declaraciones/d2?tab=condominos')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(fetch!.calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('presents it when its titular annulled its declaración (a descargo), with no % for the backend to refuse', async () => {
    const anulada = { ...declaracion, id: 'd2', contribuyente: 'c2', estado: 'ANULADA' }
    start('/declaraciones/nueva?predio=p1', [
      { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion: anulada, predio: null, contribuyente: otro }] },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }
    ])
    await hastaLaUbicacion()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/predios/p1/declaraciones'))).toBe(true))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const post = await waitFor(() => fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/declaraciones-juradas')!)
    // what it greys but sets goes as it shows: FÍSICO, today
    expect(post.body).toMatchObject({
      predio_id: 'p1',
      declaracion: { condicion_propiedad: 'PROPIETARIO UNICO', porcentaje_condominio: null, medio_presentacion: 'FISICO', fecha_presentacion: today() }
    })
  })

  it('looks its titulares up by the secuencia de uso as it is now, changed after going back by the tab', async () => {
    const suya = { ...declaracion, id: 'd2', contribuyente: 'c2' }
    start('/declaraciones/nueva?predio=p1', [
      { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion: suya, predio: null, contribuyente: otro }] },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }
    ])
    await hastaLaUbicacion()
    expect(await screen.findByRole('alert')).toHaveTextContent(`El predio ya tiene titular en ${year}`)
    // another use of the predio, with no titular yet: what is presented is datos del predio as it is now
    await userEvent.click(screen.getByRole('tab', { name: 'Datos del predio' }))
    await userEvent.clear(screen.getByLabelText(/Secuencia de uso/))
    await userEvent.type(screen.getByLabelText(/Secuencia de uso/), '002')
    await userEvent.click(screen.getByRole('tab', { name: 'Datos de la ubicación' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const post = await waitFor(() => fetch!.calls.find((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/declaraciones-juradas')!)
    expect(post.body).toMatchObject({ predio_id: 'p1', declaracion: { secuencia_uso: '002' } })
  })
})

describe('la ubicación respecto a áreas verdes (wasichai/srtm-ui#94)', () => {
  it("requires it once the year's servicio uses INFLUENCIA, optional until then", async () => {
    start('/declaraciones/d1?tab=ubicacion', [
      {
        path: '/srtm/arbitrios/parametros',
        body: {
          anio: year,
          ordenanza: null,
          servicios: [],
          parametros: [
            {
              id: null,
              tipo: 'DIMENSIONES_ARBITRIO',
              clave: 'LIMPIEZA',
              texto: 'ZONA,USO,INFLUENCIA',
              vigencia_desde: null,
              vigencia_hasta: null,
              valor_numerico: null,
              norma: null,
              fuente: null,
              transcribio: null,
              verifico: null
            }
          ],
          faltan: []
        }
      }
    ])
    await screen.findByRole('tab', { name: 'Datos de la ubicación' })
    // a servicio del año usa INFLUENCIA: se vuelve obligatoria
    await waitFor(() => expect(screen.getByText(/^Ubicación respecto a áreas verdes/).textContent).toContain('*'))
  })

  // the wizard's ubicación step comes after datos del predio, which says the año: a new predio is asked for it there
  it('requires it in the wizard of a new predio too, by the año of its datos del predio', async () => {
    const otroAnio = year + 2
    const conInfluencia = (anio: number) => ({
      path: new RegExp(`^/srtm/arbitrios/parametros\\?anio=${anio}$`),
      body: {
        anio,
        ordenanza: null,
        servicios: [],
        parametros: [
          {
            id: null,
            tipo: 'DIMENSIONES_ARBITRIO',
            clave: 'PARQUES',
            texto: 'ZONA, INFLUENCIA',
            vigencia_desde: null,
            vigencia_hasta: null,
            valor_numerico: null,
            norma: null,
            fuente: null,
            transcribio: null,
            verifico: null
          }
        ],
        faltan: []
      }
    })
    start('/contribuyentes/c1/declaraciones/nueva', [
      // the año the form starts with: no INFLUENCIA. the one the clerk types: INFLUENCIA
      { path: new RegExp(`^/srtm/arbitrios/parametros\\?anio=${year}$`), body: { anio: year, ordenanza: null, servicios: [], parametros: [], faltan: [] } },
      conInfluencia(otroAnio)
    ])
    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.clear(screen.getByLabelText(/^Año/))
    await userEvent.type(screen.getByLabelText(/^Año/), String(otroAnio))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(screen.getByText(/^Ubicación respecto a áreas verdes/).textContent).toContain('*'))
  })

  it('leaves it optional in the wizard of a new predio when no servicio of its año uses INFLUENCIA', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [
      { path: '/srtm/arbitrios/parametros', body: { anio: year, ordenanza: null, servicios: [], parametros: [], faltan: [] } }
    ])
    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/arbitrios/parametros'))).toBe(true))
    expect(screen.getByText(/^Ubicación respecto a áreas verdes/).textContent).not.toContain('*')
  })

  it('leaves it optional when no servicio del año uses INFLUENCIA, as today', async () => {
    // no se mockea /srtm/arbitrios/parametros: el 404 del mock deja la query en error, como si el backend aún no
    // tuviera esas filas
    start('/declaraciones/d1?tab=ubicacion')
    await screen.findByRole('tab', { name: 'Datos de la ubicación' })
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/arbitrios/parametros'))).toBe(true))
    expect(screen.getByText(/^Ubicación respecto a áreas verdes/).textContent).not.toContain('*')
  })
})

describe('the lists, as the srtm draws them', () => {
  const nivel = {
    id: 'n1',
    tipo_nivel: 'SOTANO',
    numero_piso: 1,
    anio_construccion: 2024,
    mes_construccion: 3,
    material: 'LADRILLO',
    estado_conservacion: 'BUENO',
    area_construida: 200,
    area_comun: 0,
    muros_columnas: 'C',
    techos: 'C',
    puertas_ventanas: 'D',
    estado: 'ACTIVO'
  }
  const obra = {
    id: 'o1',
    ingreso: 'POR CATEGORIAS',
    tipo_obra: 'MUROS PERIMETRICOS O CERCOS',
    material: 'LADRILLO',
    estado_conservacion: 'BUENO',
    categoria: '3',
    mes_construccion: 2,
    anio_construccion: 2024,
    cantidad: 2,
    metrado: 50,
    estado: 'ACTIVO'
  }
  const frente = { id: 'f1', tipo_via: 'AVENIDA', via: 'ANDRES AVELINO CACERES', numero: '1', frontis: 7, lado: 'IMPAR', estado: 'ACTIVO' }

  it('lists niveles and obras with no estado column and their options as the srtm writes them (pages 17 and 20)', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [
      { path: '/srtm/declaraciones/d1/niveles', body: [nivel] },
      { path: '/srtm/declaraciones/d1/obras', body: [obra] }
    ])
    const niveles = await screen.findByRole('grid', { name: 'Listado de niveles de construcción' })
    expect(within(niveles).getByRole('cell', { name: 'SÓTANO' })).toBeInTheDocument()
    expect(within(niveles).queryByRole('columnheader', { name: 'Estado' })).not.toBeInTheDocument()
    const obras = screen.getByRole('grid', { name: 'Listado de obras complementarias' })
    expect(within(obras).getByRole('cell', { name: 'MUROS PERIMÉTRICOS O CERCOS' })).toBeInTheDocument()
    expect(within(obras).queryByRole('columnheader', { name: 'Estado' })).not.toBeInTheDocument()
    // nor in its dialog (page 16)
    await userEvent.click(within(niveles).getByRole('cell', { name: 'SÓTANO' }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar nivel de construcción' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText(/^Estado$/)).not.toBeInTheDocument()
  })

  it('lists otros frentes with no estado column, the tipo de vía as the address writes it (page 21)', async () => {
    start('/declaraciones/d1?tab=frentes', [{ path: '/srtm/declaraciones/d1/frentes', body: [frente] }])
    const frentes = await screen.findByRole('grid', { name: 'Listado de otros frentes' })
    expect(within(frentes).getByRole('cell', { name: 'AV.' })).toBeInTheDocument()
    expect(within(frentes).queryByRole('columnheader', { name: 'Estado' })).not.toBeInTheDocument()
  })

  it("shows a contribuyente's list options by their labels too", async () => {
    start('/contribuyentes/c1?tab=contacto', [
      {
        path: '/srtm/contribuyentes/c1/medios-contacto',
        body: [{ id: 'm1', codigo: '1', tipo: 'TELEFONO CELULAR', valor: '987654321', principal: true, estado: 'ACTIVO' }]
      }
    ])
    const medios = await screen.findByRole('grid', { name: 'Listado de medios de contacto' })
    expect(within(medios).getByRole('cell', { name: 'TELÉFONO CELULAR' })).toBeInTheDocument()
  })
})
