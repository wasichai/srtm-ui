import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute, type RecordedCall } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import type { LotesMapProps } from './components/LotesMap'

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
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => props.onSelect?.(id)}>
            lote {id}
          </button>
        ))}
        <button type="button" onClick={() => props.onBounds?.([-75.23, -10.95, -75.22, -10.94])}>
          mover mapa
        </button>
        {props.draw && (
          <button type="button" onClick={() => props.draw?.onChange(SQUARE)}>
            dibujar cuadrado
          </button>
        )}
        {props.point && (
          <button type="button" onClick={() => props.point?.onChange({ type: 'Point', coordinates: [-75.2247, -10.9475] })}>
            marcar punto
          </button>
        )}
      </div>
    )
  }
}))

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
  razon_social: null,
  domicilio_fiscal: 'JR. LIMA 123',
  domicilio_distrito: 'PERENE',
  domicilio_provincia: 'CHANCHAMAYO',
  domicilio_departamento: 'JUNIN',
  codigo: '000012',
  numero_declaracion: 12,
  fecha_registro: '2026-09-24',
  motivo: 'INSCRIPCION',
  medio_determinacion: 'DECLARACION JURADA',
  medio_presentacion: 'FISICO',
  modificacion_oficio: null,
  fecha_presentacion: '2026-09-24',
  tipo_contribuyente: 'PERSONA NATURAL',
  codigo_anterior: null,
  fuente_informacion: 'MANUAL',
  fecha_nacimiento: '2005-09-07',
  fecha_fallecimiento: null,
  estado_civil: 'SOLTERO',
  sexo: 'HOMBRE',
  observacion: 'PRIMERA VISITA'
}
const relacionado = {
  id: 'r1',
  contribuyente: 'c1',
  tipo_relacionado: 'CONYUGE',
  tipo_documento: 'DNI',
  numero_documento: '43434352',
  fuente_informacion: 'MANUAL',
  apellido_paterno: 'NEIRA',
  apellido_materno: 'CAMPOS',
  nombres: 'DUBERLI',
  telefono_celular: '987654321',
  telefono_fijo: null,
  anexo: null,
  correo: null,
  fecha_inicio: null,
  fecha_fin: null,
  fecha_fallecimiento: null,
  estado: 'ACTIVO'
}
const ubigeos = [
  { codigo: '120301', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'CHANCHAMAYO' },
  { codigo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' },
  { codigo: '120601', departamento: 'JUNIN', provincia: 'SATIPO', distrito: 'SATIPO' },
  { codigo: '140101', departamento: 'LAMBAYEQUE', provincia: 'CHICLAYO', distrito: 'CHICLAYO' }
]
const categorias = [
  { columna: 1, categoria: 'MUROS Y COLUMNAS', letra: 'C', descripcion: 'PLACAS DE CONCRETO (E= 10 A 15 CM), ALBAÑILERÍA ARMADA' },
  { columna: 1, categoria: 'MUROS Y COLUMNAS', letra: 'D', descripcion: 'LADRILLO O SIMILAR SIN ELEMENTOS DE CONCRETO ARMADO' },
  { columna: 2, categoria: 'TECHOS', letra: 'C', descripcion: 'ALIGERADO O LOSAS DE CONCRETO ARMADO HORIZONTALES' },
  { columna: 4, categoria: 'PUERTAS Y VENTANAS', letra: 'D', descripcion: 'VENTANAS DE ALUMINIO, PUERTAS DE MADERA SELECTA' }
]
const predio = {
  id: 'p1',
  codigo: '01-01-0001',
  sector_catastral: '01',
  manzana_catastral: '01',
  tipo_predio: 'PREDIO URBANO',
  direccion: 'JR. LIMA 123',
  via: null,
  numero: '123',
  manzana: null,
  lote: null,
  habilitacion_urbana: null,
  ubicacion_area_verde: null
}
const declaracion = {
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  secuencia_uso: '1',
  condicion_propiedad: 'PROPIETARIO UNICO',
  porcentaje_condominio: 100,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACIÓN',
  clasificacion: null,
  estado_construccion: 'TERMINADO',
  area_terreno: 120,
  area_construida: 90,
  longitud_frente: 8,
  numero_habitantes: 4,
  valor_autoavaluo: 10080.45,
  valor_condominio: null,
  deduccion: null,
  valor_afecto: 8000
}
const totales = { declaraciones: 1, autoavaluo: 10080.45, valor_afecto: 8000 }
const page = (content: unknown[], pageNumber = 0, totalElements = content.length, totalPages = 1) => ({
  content,
  page: pageNumber,
  size: 20,
  totalElements,
  totalPages
})

const dj = {
  declaracion: {
    ...declaracion,
    numero_declaracion: 39147,
    tipo_adquisicion: 'COMPRA',
    fecha_adquisicion: '2024-09-04',
    folios: 2,
    documentos_sustento: 'MINUTA',
    medio_presentacion: 'FISICO',
    fecha_presentacion: '2026-09-24'
  },
  predio: { ...predio, numero_registro: 5243, region: 'SELVA' },
  contribuyente,
  actualizado: '2026-09-25T14:03:00Z'
}
const loteCatastro = {
  id: 'k1',
  codigo_cpu: '54102166-0001-2',
  codigo_predio_municipal: '5243',
  partida_registral: '11002233',
  tipo_predio: 'PREDIO URBANO',
  ubigeo: '120302',
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

const routes: MockRoute[] = [
  { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { method: 'PUT', path: '/auth/me/preferences', body: { theme: 'light', locale: null } },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 11840, predios: 14947, declaraciones: 15644 } },
  {
    path: '/srtm/catalogos',
    body: {
      contribuyente: {
        tipo_persona: ['NATURAL', 'JURIDICA', 'SUCESION'],
        tipo_documento: ['DNI', 'RUC'],
        tipo_contribuyente: ['PERSONA NATURAL', 'PERSONA JURIDICA', 'SOCIEDAD CONYUGAL'],
        motivo: ['INSCRIPCION', 'ACTUALIZACION'],
        medio_determinacion: ['DECLARACION JURADA'],
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        modificacion_oficio: ['FISCALIZACION'],
        fuente_informacion: ['MANUAL', 'PIDE RENIEC'],
        estado_civil: ['SOLTERO', 'CASADO'],
        sexo: ['HOMBRE', 'MUJER']
      },
      domicilio: {
        tipo_domicilio: ['FISCAL', 'REAL'],
        tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
        tipo_via: ['AVENIDA', 'CALLE'],
        tipo_unidad_urbana: ['CENTRO POBLADO', 'CERCADO'],
        estado: ['ACTIVO', 'INACTIVO']
      },
      relacionado: { tipo_relacionado: ['CONYUGE', 'APODERADO'], tipo_documento: ['DNI', 'RUC'], estado: ['ACTIVO', 'INACTIVO'] },
      predio: {
        tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
        region: ['COSTA', 'SIERRA', 'SELVA'],
        tipo_via: ['AVENIDA', 'CALLE'],
        tipo_zona: ['URBANIZACION', 'CERCADO']
      },
      declaracion_predial: {
        medio_presentacion: ['FISICO', 'VIRTUAL'],
        medio_determinacion: ['DECLARACION JURADA'],
        motivo: ['INSCRIPCION'],
        tipo_adquisicion: ['COMPRA', 'HERENCIA'],
        condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO'],
        condicion_especial: ['PENSIONISTA', 'INAFECTO'],
        condicion_tipo_documento: ['RESOLUCION'],
        inhabitable_tipo_documento: ['RESOLUCION']
      },
      nivel_construccion: {
        tipo_nivel: ['PISO', 'SOTANO'],
        material: ['LADRILLO', 'ADOBE'],
        estado_conservacion: ['BUENO', 'REGULAR'],
        estado: ['ACTIVO', 'INACTIVO']
      },
      obra_complementaria: {
        ingreso: ['POR CATEGORIAS', 'CON VALORIZACION'],
        tipo_obra: ['MUROS PERIMETRICOS O CERCOS', 'TANQUES ELEVADOS'],
        unidad_medida: ['M2', 'ML']
      }
    }
  },
  { path: '/srtm/ubigeos', body: ubigeos },
  { path: '/srtm/vias', body: page([{ id: 'v1', tipo_via: 'AVENIDA', nombre: 'MARGINAL', ubigeo: '120302' }]) },
  { path: '/srtm/unidades-urbanas', body: page([{ id: 'u1', tipo_unidad_urbana: 'CENTRO POBLADO', nombre: 'UNION PERENE', ubigeo: '120302' }]) },
  { path: '/srtm/contribuyentes/c1/domicilios', body: [] },
  { path: '/srtm/contribuyentes/c1/relacionados', body: [relacionado] },
  { path: '/srtm/contribuyentes/c1/medios-contacto', body: [] },
  { path: '/srtm/contribuyentes/c1/sustentos', body: [] },
  { path: '/srtm/categorias-valor', body: categorias },
  { path: '/srtm/declaraciones/d1', body: dj },
  { path: '/srtm/declaraciones/d1/transferentes', body: [] },
  { path: '/srtm/declaraciones/d1/niveles', body: [] },
  { path: '/srtm/declaraciones/d1/obras', body: [] },
  { path: '/srtm/declaraciones/d1/frentes', body: [] },
  { path: /^\/srtm\/contribuyentes\?.*page=1/, body: page([{ ...contribuyente, id: 'c2', nombre_completo: 'SEGUNDA PAGINA' }], 1, 21, 2) },
  { path: '/srtm/contribuyentes', body: page([contribuyente], 0, 21, 2) },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/contribuyentes/c1/declaraciones', body: [{ declaracion, predio, contribuyente: null }] },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion, predio: null, contribuyente }] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = [], signedIn = true) {
  if (signedIn) {
    localStorage.setItem('srtm.token', 't')
    localStorage.setItem('srtm.user', JSON.stringify(admin))
  }
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

const tabBar = () => screen.getByRole('navigation', { name: 'Fichas abiertas' })

describe('portal', () => {
  it('sends a stranger to the login, and back where they were going after it', async () => {
    start('/contribuyentes', [], false)
    await userEvent.type(await screen.findByLabelText('Contraseña'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('heading', { name: 'Contribuyentes' })).toBeInTheDocument()
    // the admin reads the same keys: one sign-in for both
    expect(localStorage.getItem('srtm.token')).toBe('t')
    expect(JSON.parse(localStorage.getItem('srtm.user')!).email).toBe('admin@wasichai.local')
  })

  it('opens on the home page with the padron totals', async () => {
    start('/')
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(await screen.findByText((11840).toLocaleString('es-PE'))).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
  })

  it('skips the header, the menu and the workspace tabs to the screen, from the first tab stop', async () => {
    start('/')
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const contenido = document.getElementById('contenido')!
    expect(contenido).toHaveFocus()
    expect(contenido).toContainElement(screen.getByRole('heading', { name: 'Inicio' }))
    // the focus moves, the url stays
    expect(window.location.pathname).toBe('/')
    expect(window.location.hash).toBe('')
  })

  it('switches the theme from a menu and stores it for the user, as the admin does', async () => {
    start('/', [{ method: 'PUT', path: '/auth/me/preferences', body: { theme: 'portal-tributario', locale: null } }])
    const button = await screen.findByRole('button', { name: /^Tema: Sistema/ })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    // system plus every theme core knows, the srtm ones included
    const menu = screen.getByRole('menu', { name: 'Tema' })
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent)).toEqual(['Sistema', 'Claro', 'Oscuro', 'Portal tributario'])
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])

    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Portal tributario' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('portal-tributario'))
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('srtm.theme')).toBe('portal-tributario')
    await waitFor(() => expect(fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/auth/me/preferences')?.body).toEqual({ theme: 'portal-tributario' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Tema: Portal tributario/ })).toHaveFocus()
  })

  it('works the theme menu from the keyboard, and closes it with escape or a click outside', async () => {
    start('/')
    const button = await screen.findByRole('button', { name: /^Tema: Sistema/ })
    button.focus()
    await userEvent.keyboard('{Enter}')
    const menu = screen.getByRole('menu', { name: 'Tema' })
    // focus goes to the theme in use, and the arrows walk the menu round
    expect(within(menu).getByRole('menuitemradio', { name: 'Sistema' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Claro' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Portal tributario' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Sistema' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(within(menu).getByRole('menuitemradio', { name: 'Portal tributario' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()

    await userEvent.click(button)
    expect(screen.getByRole('menu', { name: 'Tema' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('heading', { name: 'Inicio' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // opened and closed, never picked: the user's theme stays, nothing sent
    expect(localStorage.getItem('srtm.theme')).toBe('system')
    expect(fetch!.calls.some((c) => c.method === 'PUT' && c.path === '/auth/me/preferences')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  // core sends an id it does not know (an old build, another app's theme) to the os setting, and so does the menu
  it('shows a stored theme it does not know as system', async () => {
    start('/', [{ path: '/auth/me/preferences', body: { theme: 'otra-app', locale: null } }])
    await userEvent.click(await screen.findByRole('button', { name: /^Tema: Sistema/ }))
    expect(screen.getByRole('menuitemradio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('keeps the theme and says why when the backend refuses it', async () => {
    start('/', [{ method: 'PUT', path: '/auth/me/preferences', status: 500, body: { title: 'Error', detail: 'sin conexión' } }])
    await userEvent.click(await screen.findByRole('button', { name: /^Tema: Sistema/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Oscuro' }))
    const button = screen.getByRole('button', { name: /^Tema: Sistema/ })
    await waitFor(() => expect(button).toHaveAttribute('title', expect.stringMatching(/sin conexión/)))
    expect(button).toHaveClass('text-danger')
    expect(localStorage.getItem('srtm.theme')).toBe('system')
  })

  it('searches contribuyentes and pages through them', async () => {
    start('/contribuyentes')
    expect(await screen.findByText('QUISPE MAMANI JUAN')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar contribuyentes'), 'quispe')
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/contribuyentes?q=quispe'))).toBe(true))
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(await screen.findByText('SEGUNDA PAGINA')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  })

  it('counts a long list as the srtm writes figures (es-PE)', async () => {
    start('/contribuyentes', [{ path: '/srtm/contribuyentes', body: page([contribuyente], 0, 12345, 618) }])
    expect(await screen.findByText('12,345 registros')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 618')).toBeInTheDocument()
  })

  it('keeps every open ficha as a workspace tab, and closing one moves to its neighbour', async () => {
    start('/contribuyentes')
    await userEvent.click(await screen.findByRole('link', { name: '20529936' }))
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    expect(await within(tabBar()).findByRole('link', { name: /20529936 QUISPE MAMANI JUAN/ })).toBeInTheDocument()

    // from the contribuyente's predios to the predio: a second tab
    await userEvent.click(screen.getByRole('tab', { name: 'Predios' }))
    await userEvent.click(await screen.findByRole('link', { name: '01-01-0001' }))
    expect(await screen.findByRole('heading', { name: '01-01-0001 · JR. LIMA 123' })).toBeInTheDocument()
    expect(await within(tabBar()).findByRole('link', { name: '01-01-0001' })).toBeInTheDocument()

    await userEvent.click(within(tabBar()).getByRole('button', { name: 'Cerrar 01-01-0001' }))
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    expect(within(tabBar()).queryByRole('link', { name: '01-01-0001' })).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('srtm.tabs')!)).toHaveLength(1)
  })

  it('loads a ficha tab only when it is opened: the year for Predios, every year for Declaraciones', async () => {
    start('/contribuyentes/c1')
    expect(await screen.findByRole('heading', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
    const declaraciones = () => fetch!.calls.filter((c) => c.path.startsWith('/srtm/contribuyentes/c1/declaraciones'))
    expect(declaraciones()).toHaveLength(0)

    await userEvent.click(screen.getByRole('tab', { name: 'Predios' }))
    expect(await screen.findByText(`Total ${year}`)).toBeInTheDocument()
    expect(declaraciones().map((c) => c.path)).toEqual([`/srtm/contribuyentes/c1/declaraciones?anio=${year}`])

    await userEvent.click(screen.getByRole('tab', { name: 'Declaraciones' }))
    expect(await screen.findByRole('link', { name: `Editar declaración ${year}` })).toBeInTheDocument()
    expect(declaraciones().map((c) => c.path)).toContain('/srtm/contribuyentes/c1/declaraciones')
  })

  it('edits a contribuyente and shows the field the backend rejects under that field', async () => {
    start('/contribuyentes/c1', [
      {
        method: 'PUT',
        path: '/srtm/contribuyentes/c1',
        status: 400,
        body: { title: 'Bad Request', detail: 'invalid record', errors: [{ field: 'numero_documento', message: 'ya existe' }] }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    // the backend's own fields show, but cannot be typed into
    expect(screen.getByLabelText('Código de contribuyente')).toBeDisabled()
    expect(screen.getByLabelText('Código de contribuyente')).toHaveValue('000012')
    await userEvent.clear(screen.getByLabelText('Observación'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('ya existe')).toBeInTheDocument()
    expect(screen.getByLabelText(/N° documento/)).toHaveAttribute('aria-invalid', 'true')
    const put = fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/srtm/contribuyentes/c1')!
    // a cleared field goes as null, so the backend clears it too; read-only ones keep the stored value
    expect(put.body).toMatchObject({ numero_documento: '20529936', observacion: null, codigo: '000012', sexo: 'HOMBRE' })
  })

  it('asks an imported contribuyente for what the srtm requires before saving it', async () => {
    const importado = { ...contribuyente, tipo_contribuyente: null, sexo: null, estado_civil: null, medio_presentacion: null, fecha_presentacion: null }
    start('/contribuyentes/c1', [{ path: '/srtm/contribuyentes/c1', body: { contribuyente: importado, anio: year, predios: 1, totales } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    for (const label of ['Tipo de contribuyente', 'Sexo', 'Estado civil', 'Medio de presentación']) {
      expect(screen.getByLabelText(new RegExp(label))).toHaveAttribute('aria-invalid', 'true')
    }
    expect(fetch!.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('inscribes a contribuyente in the wizard and moves on to its domicilios', async () => {
    const inscrito = { ...contribuyente, id: 'c9', codigo: '000013' }
    start('/contribuyentes/nuevo', [
      { method: 'POST', path: '/srtm/contribuyentes', status: 201, body: inscrito },
      { path: '/srtm/contribuyentes/c9', body: { contribuyente: inscrito, anio: year, predios: 0, totales: { ...totales, declaraciones: 0 } } },
      { path: '/srtm/contribuyentes/c9/domicilios', body: [] }
    ])
    expect(await screen.findByRole('heading', { name: 'Nuevo contribuyente' })).toBeInTheDocument()
    // the other tabs wait for the contribuyente to exist
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toBeDisabled()
    expect(screen.getByLabelText('Código de contribuyente')).toHaveAttribute('placeholder', '(AUTOGENERADO)')

    await userEvent.selectOptions(await screen.findByLabelText(/Tipo de contribuyente/), 'PERSONA NATURAL')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de documento/), 'DNI')
    await userEvent.type(screen.getByLabelText(/N° documento/), '43554564')
    await userEvent.type(screen.getByLabelText('Apellido paterno'), 'FLORES')
    await userEvent.type(screen.getByLabelText(/Nombres/), 'JUNIOR PAOLO')
    await userEvent.selectOptions(screen.getByLabelText(/Estado civil/), 'SOLTERO')
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'HOMBRE')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes')
    expect(post.body).toMatchObject({
      tipo_contribuyente: 'PERSONA NATURAL',
      numero_documento: '43554564',
      motivo: 'INSCRIPCION',
      medio_presentacion: 'FISICO',
      fuente_informacion: 'MANUAL',
      codigo: null
    })
    expect(await screen.findByText('(*) Registrar al menos 1 domicilio fiscal')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'true')
  })

  it('asks a persona juridica for its razon social instead of names', async () => {
    start('/contribuyentes/nuevo')
    expect(await screen.findByLabelText(/Nombres/)).toBeInTheDocument()
    await userEvent.selectOptions(await screen.findByLabelText(/Tipo de contribuyente/), 'PERSONA JURIDICA')
    expect(screen.getByLabelText(/Razón social/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Nombres/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Sexo/)).not.toBeInTheDocument()
  })

  it('adds a fiscal domicilio with the ubigeo cascade and a live description', async () => {
    start('/contribuyentes/c1?tab=domicilios', [
      { method: 'POST', path: '/srtm/contribuyentes/c1/domicilios', status: 201, body: { id: 'd1', estado: 'ACTIVO' } }
    ])
    expect(await screen.findByText('(*) Registrar al menos 1 domicilio fiscal')).toBeInTheDocument()
    expect(screen.getByText('Domicilio fiscal del padrón: JR. LIMA 123')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar domicilio' }))

    const dialog = await screen.findByRole('dialog')
    // no fiscal one yet: this one is; Perené comes preselected
    expect(within(dialog).getByLabelText(/Tipo de domicilio/)).toHaveValue('FISCAL')
    expect(await within(dialog).findByRole('option', { name: 'PERENE' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Distrito/)).toHaveValue('PERENE')
    // another province: the district list follows it, and the old district is gone
    await userEvent.selectOptions(within(dialog).getByLabelText(/Provincia/), 'SATIPO')
    expect(within(dialog).getByLabelText(/Distrito/)).toHaveValue('')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Distrito/), 'SATIPO')

    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo de vía'), 'AVENIDA')
    await userEvent.type(within(dialog).getByLabelText(/Descripción de la vía/), 'MARGINAL')
    await userEvent.type(within(dialog).getByLabelText('Número principal'), '234')
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo unidad urbana'), 'CERCADO')
    await userEvent.type(within(dialog).getByLabelText(/Descripción unidad urbana/), 'II MESETA')
    expect(within(dialog).getByText('AV. MARGINAL, N° 234, CER II MESETA, JUNIN-SATIPO-SATIPO')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))

    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/domicilios')
    expect(post.body).toMatchObject({
      tipo_domicilio: 'FISCAL',
      departamento: 'JUNIN',
      provincia: 'SATIPO',
      distrito: 'SATIPO',
      ubigeo: '120601',
      via: 'MARGINAL',
      numero: '234'
    })
    expect(post.body).not.toHaveProperty('ubigeo_cascada')
  })

  it('removes a relacionado only after confirming', async () => {
    start('/contribuyentes/c1?tab=relacionados', [{ method: 'DELETE', path: '/srtm/relacionados/r1', status: 204 }])
    expect(await screen.findByText('NEIRA CAMPOS DUBERLI')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('row', { name: /NEIRA CAMPOS DUBERLI/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar relacionado' }))
    expect(fetch!.calls.some((c) => c.method === 'DELETE')).toBe(false)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(fetch!.calls.some((c) => c.method === 'DELETE' && c.path === '/srtm/relacionados/r1')).toBe(true))
  })

  it('presents a declaracion jurada on a new predio: datos del predio, then its ubicacion with its lote', async () => {
    start('/contribuyentes/c1?tab=declaraciones', [{ method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }])
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva declaración' }))
    expect(await screen.findByRole('heading', { name: 'Nueva declaración jurada predial' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datos de la ubicación' })).toBeDisabled()
    // the predio's own fields, shown in datos del predio as in the srtm
    expect(screen.getByLabelText('Código de predio')).toHaveAttribute('placeholder', '(AUTOGENERADO)')
    expect(screen.getByLabelText('Número de registro de predio')).toHaveAttribute('placeholder', '(AUTOGENERADO)')

    await screen.findByRole('option', { name: 'COMPRA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'COMPRA')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de predio/), 'PREDIO RUSTICO')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2024-09-04')
    await userEvent.type(screen.getByLabelText(/Folios/), '2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'MINUTA' }))
    await userEvent.type(screen.getByLabelText('Otros datos'), 'LINDA CON EL RIO')
    // the condición's fields wait for a condición
    expect(screen.getByLabelText('Fecha de inicio de condición')).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.type(screen.getByLabelText(/^Sector/), '01')
    await userEvent.type(screen.getByLabelText(/Manzana catastral/), '02')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de vía/), 'AVENIDA')
    await userEvent.type(screen.getByLabelText(/Descripción de la vía/), 'MARGINAL')
    await userEvent.type(screen.getByLabelText(/Descripción de la zona/), 'II MESETA')
    await userEvent.type(screen.getByLabelText(/^Código CPU/), '54102166-0001-2')
    // the lote, drawn on the catastro map
    await userEvent.click(screen.getByRole('button', { name: 'Dibujar lote' }))
    await userEvent.click(screen.getByRole('button', { name: 'dibujar cuadrado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(within(screen.getByTestId('lotes-map')).getByTestId('lote-elegido')).toHaveTextContent('lote-del-predio')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/declaraciones-juradas')
    expect(post.body).toMatchObject({
      declaracion: { tipo_adquisicion: 'COMPRA', folios: 2, documentos_sustento: 'MINUTA', otros_datos: 'LINDA CON EL RIO' },
      predio: {
        sector_catastral: '01',
        manzana_catastral: '02',
        tipo_predio: 'PREDIO RUSTICO',
        via: 'MARGINAL',
        codigo_cpu: '54102166-0001-2',
        lote_geom: SQUARE,
        distrito: 'PERENE',
        codigo: null
      }
    })
    // tipo de predio is the predio's, not the declaration's
    expect((post.body as { declaracion: object }).declaracion).not.toHaveProperty('tipo_predio')
    expect(await screen.findByRole('heading', { name: 'Declaración jurada predial - 39147' })).toBeInTheDocument()
  })

  it('presents a declaracion jurada on a predio found with buscar predios', async () => {
    start('/contribuyentes/c1/declaraciones/nueva', [
      { path: '/srtm/predios/buscar', body: page([{ ...predio, lote_geom: SQUARE }]) },
      // no titular yet this year: one would be joined as a condómino instead (grisObligatorio.test.tsx)
      { path: '/srtm/predios/p1/declaraciones', body: [] },
      { method: 'POST', path: '/srtm/contribuyentes/c1/declaraciones-juradas', status: 201, body: dj }
    ])
    await screen.findByRole('option', { name: 'HERENCIA' })
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de adquisición/), 'HERENCIA')
    await userEvent.type(screen.getByLabelText(/Fecha de adquisición/), '2020-01-15')
    await userEvent.type(screen.getByLabelText(/Folios/), '4')
    await userEvent.click(screen.getByRole('checkbox', { name: 'DECLARATORIA DE HEREDEROS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Tributario' }))
    // the srtm wants the vía, unless a code says which predio
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/descripción de la vía/)
    await userEvent.type(within(dialog).getByLabelText(/Descripción de la vía/), 'LIMA')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
    const call = await called((c) => c.path.startsWith('/srtm/predios/buscar'))
    expect(call.path).toContain('via=LIMA')
    expect(call.path).toContain('tipo_predio=PREDIO+URBANO')
    // the row and the lote on the map are the same pick
    await userEvent.click(await within(dialog).findByRole('button', { name: 'lote p1' }))
    expect(within(dialog).getByRole('row', { selected: true })).toHaveTextContent('01-01-0001')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elegir' }))

    expect(await screen.findByText(/La declaración será sobre el predio/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/declaraciones-juradas')
    expect(post.body).toMatchObject({ predio_id: 'p1', declaracion: { tipo_adquisicion: 'HERENCIA', documentos_sustento: 'DECLARATORIA DE HEREDEROS' } })
    expect(post.body).not.toHaveProperty('predio')
  })

  it('declares a nivel de construccion with the official descriptions of its letters', async () => {
    start('/declaraciones/d1?tab=caracteristicas', [{ method: 'POST', path: '/srtm/declaraciones/d1/niveles', status: 201, body: { id: 'n1' } }])
    expect(await screen.findByText('Listado de niveles de construcción')).toBeInTheDocument()
    // a propietario único adds its first condómino there (srtm-backend#4)
    expect(screen.getByRole('tab', { name: 'Datos de los condóminos' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar nivel de construcción' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Mes construcción/), '1')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Material predominante/), 'LADRILLO')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Estado de conservación/), 'BUENO')
    await userEvent.type(within(dialog).getByLabelText(/Área construida/), '200')
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Muros y columnas/), 'C')
    expect(within(dialog).getByText('PLACAS DE CONCRETO (E= 10 A 15 CM), ALBAÑILERÍA ARMADA')).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText(/Techos/), 'C')
    // puertas y ventanas is required too: the srtm will not take the nivel without it
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    expect(fetch!.calls.some((c) => c.method === 'POST' && c.path === '/srtm/declaraciones/d1/niveles')).toBe(false)
    await userEvent.selectOptions(within(dialog).getByLabelText(/Puertas y ventanas/), 'D')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/declaraciones/d1/niveles')
    expect(post.body).toMatchObject({
      tipo_nivel: 'PISO',
      numero_piso: 1,
      mes_construccion: 1,
      area_construida: 200,
      muros_columnas: 'C',
      techos: 'C',
      puertas_ventanas: 'D',
      pisos: null
    })
  })

  it("shows an obra complementaria's total metrado while it is typed", async () => {
    start('/declaraciones/d1?tab=caracteristicas')
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar obra complementaria' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Cantidad/), '2')
    await userEvent.type(within(dialog).getByLabelText(/^Metrado/), '50')
    expect(within(dialog).getByText('100 M2')).toBeInTheDocument()
    // con valorización asks for the value instead of the category
    expect(within(dialog).getByLabelText(/Categoría/)).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText(/Ingreso/), 'CON VALORIZACION')
    expect(within(dialog).queryByLabelText(/Categoría/)).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Valor/)).toBeInTheDocument()
  })

  it('fills the ubicacion from a lote of the catastro fiscal, with its CPU and its polygon', async () => {
    start('/declaraciones/d1?tab=ubicacion', [
      { path: '/srtm/catastro', body: page([loteCatastro]) },
      { path: '/srtm/predios/buscar', body: page([]) },
      { method: 'PUT', path: '/srtm/predios/p1', body: predio }
    ])
    // edited in place: no "Editar"
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' }))
    await userEvent.type(within(dialog).getByLabelText(/Descripción de la vía/), 'CACERES')
    await userEvent.type(within(dialog).getByLabelText('Manzana'), 'C')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
    const call = await called((c) => c.path.startsWith('/srtm/catastro?'))
    expect(call.path).toContain('via=CACERES')
    expect(call.path).toContain('manzana=C')
    expect(call.path).toContain('size=5')
    await userEvent.click(await within(dialog).findByRole('cell', { name: '54102166-0001-2' }))
    // the row picked is the lote highlighted on the map
    expect(within(dialog).getByTestId('lote-elegido')).toHaveTextContent('k1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elegir' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Código CPU')).toHaveValue('54102166-0001-2')
    expect(screen.getByLabelText(/Descripción de la vía/)).toHaveValue('ANDRES AVELINO CACERES')
    expect(screen.getByLabelText(/Descripción de la zona/)).toHaveValue('SOL DE LA ALAMEDA')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const put = await called((c) => c.method === 'PUT' && c.path === '/srtm/predios/p1')
    expect(put.body).toMatchObject({ codigo_cpu: '54102166-0001-2', manzana: 'C', lote: '19', lote_geom: SQUARE, partida_registral: '11002233' })
  })

  it('shows the predio in datos del predio and saves its tipo on the predio', async () => {
    start('/declaraciones/d1', [
      { method: 'PUT', path: '/srtm/declaraciones/d1', body: dj.declaracion },
      { method: 'PUT', path: '/srtm/predios/p1', body: predio }
    ])
    expect(await screen.findByLabelText('Número de registro de predio')).toHaveValue('5243')
    expect(screen.getByLabelText('Fecha de actualización')).toHaveValue('25/09/2026')
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de predio/), 'PREDIO RUSTICO')
    await userEvent.type(screen.getByLabelText('Otros datos'), 'CON RIEGO')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const declaracionPut = await called((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')
    expect(declaracionPut.body).toMatchObject({ otros_datos: 'CON RIEGO', numero_declaracion: 39147 })
    expect(declaracionPut.body).not.toHaveProperty('tipo_predio')
    const predioPut = await called((c) => c.method === 'PUT' && c.path === '/srtm/predios/p1')
    expect(predioPut.body).toMatchObject({ tipo_predio: 'PREDIO RUSTICO', codigo: '01-01-0001' })
  })

  it('opens a new predio already located from a lote of the catastro that is no predio yet', async () => {
    start('/predios', [
      { path: '/srtm/predios', body: page([predio]) },
      { path: '/srtm/catastro', body: page([{ ...loteCatastro, codigo_predio_municipal: null }]) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar predios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buscar predios' })
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Buscar en Catastro Fiscal' }))
    await userEvent.type(within(dialog).getByLabelText('Código CPU'), '54102166')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar' }))
    await userEvent.click(await within(dialog).findByRole('cell', { name: '54102166-0001-2' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elegir' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo predio' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Código CPU/)).toHaveValue('54102166-0001-2')
    expect(screen.getByLabelText(/Descripción de la vía/)).toHaveValue('ANDRES AVELINO CACERES')
    expect(screen.getByTestId('lote-elegido')).toHaveTextContent('lote-del-predio')
    expect(screen.getByText('Registro de predio', { selector: 'li' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a predio with the srtm ubicacion, its registration number and its lote', async () => {
    start('/predios/p1', [
      { path: '/srtm/predios/p1', body: { predio: { ...predio, numero_registro: 5243, lote_geom: SQUARE }, anio: year, titulares: 1, totales } }
    ])
    expect(await screen.findByText('Predio · Registro Nº 5243')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datos de la ubicación' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Predio de catastro fiscal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByTestId('lote-elegido')).toHaveTextContent('lote-del-predio')
  })

  it("takes an obra's categoria from the instructivo, which sets its unidad", async () => {
    start('/declaraciones/d1?tab=caracteristicas', [
      {
        path: '/srtm/obras-categorias',
        body: [{ tipo_obra: 'MUROS PERIMETRICOS O CERCOS', numero: 3, descripcion: 'MURO DE LADRILLO DE ARCILLA', unidad_medida: 'ML' }]
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar obra complementaria' }))
    const dialog = await screen.findByRole('dialog')
    // no tipo de obra yet: nothing in the catalog to pick, the categoría is typed
    expect(within(dialog).getByLabelText(/Categoría/).tagName).toBe('TEXTAREA')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Tipo de obra/), 'MUROS PERIMETRICOS O CERCOS')
    await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: /Categoría/ }), '3. MURO DE LADRILLO DE ARCILLA')
    expect(within(dialog).getByLabelText(/Unidad de medida/)).toHaveValue('ML')
  })

  it('pages a long list, as the srtm does', async () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({ ...relacionado, id: `r${i}`, nombres: `PERSONA ${i + 1}` }))
    start('/contribuyentes/c1?tab=relacionados', [{ path: '/srtm/contribuyentes/c1/relacionados', body: muchos }])
    expect(await screen.findByText('1 a 10 de 12 registros')).toBeInTheDocument()
    expect(screen.queryByText(/PERSONA 11/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByText('11 a 12 de 12 registros')).toBeInTheDocument()
    expect(screen.getByText(/PERSONA 11/)).toBeInTheDocument()
  })

  it('locates a domicilio on the map', async () => {
    start('/contribuyentes/c1?tab=domicilios', [
      { method: 'POST', path: '/srtm/contribuyentes/c1/domicilios', status: 201, body: { id: 'd1', estado: 'ACTIVO' } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar domicilio' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('option', { name: 'PERENE' })
    await userEvent.type(within(dialog).getByLabelText(/Descripción de la vía/), 'MARGINAL')
    await userEvent.type(within(dialog).getByLabelText(/Descripción unidad urbana/), 'II MESETA')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar dirección' }))
    const mapa = await screen.findByRole('dialog', { name: 'Ubicar el domicilio' })
    await userEvent.click(within(mapa).getByRole('button', { name: 'marcar punto' }))
    await userEvent.click(within(mapa).getByRole('button', { name: 'Aceptar' }))
    expect(await within(dialog).findByRole('button', { name: 'Ubicado en el mapa' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grabar' }))
    const post = await called((c) => c.method === 'POST' && c.path === '/srtm/contribuyentes/c1/domicilios')
    expect(post.body).toMatchObject({ ubicacion: { type: 'Point', coordinates: [-75.2247, -10.9475] } })
  })
})
