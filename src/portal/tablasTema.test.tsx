import { screen, within } from '@testing-library/react'
import { mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldGrid } from '../kit/forms/FieldGrid'
import { SRTM_THEMES } from '../themes'
import { EstadoBadge, MarcaAnulada } from './components/EstadoBadge'
import { formatNumber } from './components/format'
import { Paginador } from './components/Paginador'
import { Pagination } from './components/Pagination'
import { tonoDeEstado } from './components/tono'
import { DeclaracionesDelAnio } from './pages/Declaraciones'
import { HijosPanel } from './pages/HijosPanel'

const year = new Date().getFullYear()

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// under a theme picked in this browser (signed out, so no server preference): light is the classic variant
function renderIn(theme: 'light' | 'dark' | 'portal-tributario', ui: ReactElement) {
  localStorage.setItem('srtm.theme', theme)
  return renderWithProviders(ui, { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null })
}

// the tables of the portal-tributario theme (#49): a situación is coloured by its tone, zebra rows with a total,
// the read-only ficha as key-value rows

describe('tonoDeEstado', () => {
  it.each([
    ['VENCIDA', 'rojo'],
    ['EN COACTIVA', 'rojo'],
    ['DENEGADO', 'rojo'],
    ['INACTIVO', 'rojo'],
    ['BAJA DE OFICIO', 'rojo'],
    ['ANULADA', 'rojo'],
    ['POR VENCER', 'ambar'],
    ['EN TRÁMITE', 'ambar'],
    ['OBSERVADA', 'ambar'],
    ['CANCELADA', 'verde'],
    ['HABIDO', 'verde'],
    ['ACTIVO', 'verde'],
    ['VIGENTE', 'verde'],
    ['CONFORME', 'verde'],
    ['PROPIETARIO UNICO', '']
  ])('%s is %s', (texto, tono) => {
    expect(tonoDeEstado(texto)).toBe(tono)
  })

  it('does not tell capitals apart', () => {
    expect(tonoDeEstado('Vencida')).toBe('rojo')
    expect(tonoDeEstado('en trámite')).toBe('ambar')
    expect(tonoDeEstado('Activo')).toBe('verde')
  })

  // inactivo holds activo, and no habido holds habido: the red words go first
  it('reads the red words before the green ones they contain', () => {
    expect(tonoDeEstado('Inactivo')).toBe('rojo')
    expect(tonoDeEstado('NO HABIDO')).toBe('rojo')
  })

  it('reads a trámite written without its accent', () => {
    expect(tonoDeEstado('EN TRAMITE')).toBe('ambar')
  })

  it('has no tone for an empty text', () => {
    expect(tonoDeEstado('')).toBe('')
    expect(tonoDeEstado(null)).toBe('')
    expect(tonoDeEstado(undefined)).toBe('')
  })
})

describe('EstadoBadge', () => {
  it.each(['light', 'dark'] as const)('keeps the dark pill with %s', (theme) => {
    renderIn(theme, <EstadoBadge estado="ACTIVO" />)
    const badge = screen.getByText('Activo')
    expect(badge).toHaveClass('bg-ink', 'text-surface', 'rounded-full')
    expect(badge).not.toHaveAttribute('data-tono')
  })

  it.each([
    ['ACTIVO', 'Activo', 'verde', 'text-success'],
    ['VIGENTE', 'Vigente', 'verde', 'text-success'],
    ['ANULADA', 'Anulada', 'rojo', 'text-danger'],
    ['INACTIVO', 'Inactivo', 'rojo', 'text-danger']
  ])('is bold text coloured by its tone in the portal theme: %s', (estado, texto, tono, color) => {
    renderIn('portal-tributario', <EstadoBadge estado={estado} />)
    const badge = screen.getByText(texto)
    expect(badge).toHaveAttribute('data-tono', tono)
    expect(badge).toHaveClass(color, 'font-bold', 'text-[12.5px]')
    expect(badge).not.toHaveClass('bg-ink')
    expect(badge).not.toHaveClass('rounded-full')
  })

  it('reads the same in every theme', () => {
    const { unmount } = renderIn('light', <EstadoBadge estado={null} />)
    const clasico = screen.getByText('Activo').textContent
    unmount()
    renderIn('portal-tributario', <EstadoBadge estado={null} />)
    expect(screen.getByText('Activo').textContent).toBe(clasico)
  })

  it('marks an annulled declaración in red in the portal theme', () => {
    renderIn('portal-tributario', <MarcaAnulada declaracion={{ estado: 'ANULADA' }} />)
    const marca = screen.getByText('Anulada')
    expect(marca).toHaveAttribute('data-tono', 'rojo')
    expect(marca).toHaveClass('text-danger')
    expect(marca).not.toHaveClass('rounded-full')
  })
})

// every <Table …> the portal draws, with the attributes of its opening tag
function portalTables(): { file: string; tag: string }[] {
  const dir = __dirname
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  return files.flatMap((file) => [...readFileSync(join(dir, file), 'utf8').matchAll(/<Table\b[^>]*>/g)].map(([tag]) => ({ file, tag })))
}

// the cells of a row marked as figures
const numericas = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>(':scope > [data-numeric]')]

describe('the portal tables', () => {
  // the library's Table puts data-slot="table" itself (@wasichai/ui 0.3): no table overrides it or keeps an old hook
  it("are all the library's Table, hooked by it", () => {
    const tables = portalTables()
    expect(tables.length).toBeGreaterThanOrEqual(7)
    for (const { file, tag } of tables) expect(tag, file).not.toMatch(/data-(ui|slot)=/)
  })

  it('mark their numeric columns, right aligned with tabular figures in every theme, and keep the total in the foot', async () => {
    const declaracion = {
      id: 'd1',
      anio: year,
      porcentaje_condominio: 60,
      uso: 'CASA',
      valor_autoavaluo: 1000,
      valor_afecto: 600,
      condicion_propiedad: 'CONDOMINO'
    }
    fetch = mockFetch([
      {
        path: '/srtm/contribuyentes/c1/declaraciones',
        body: [{ declaracion, predio: { id: 'p1', codigo: '01', direccion: 'JR. LIMA' }, contribuyente: null }]
      },
      { path: '/srtm/contribuyentes/c1', body: { contribuyente: { id: 'c1' }, anio: year, totales: { declaraciones: 1, autoavaluo: 1000, valor_afecto: 600 } } }
    ])
    renderIn('light', <DeclaracionesDelAnio side="contribuyente" id="c1" anio={year} />)
    const table = await screen.findByRole('table')
    expect(table).toHaveAttribute('data-slot', 'table')

    const [head, body, foot] = within(table).getAllByRole('row')
    expect(numericas(head).map((th) => th.textContent)).toEqual(['% condominio', 'Autoavalúo', 'Valor afecto'])
    expect(numericas(body)).toHaveLength(3)
    for (const cell of [...numericas(head), ...numericas(body), ...numericas(foot)]) expect(cell).toHaveClass('text-right', 'tabular-nums')
    expect(foot.parentElement?.tagName).toBe('TFOOT')
    expect(foot).toHaveTextContent(`Total ${year}`)
    expect(numericas(foot)).toHaveLength(2)
  })

  it('mark the numeric columns of a list of a ficha, and write its estado by tone in the portal theme', async () => {
    fetch = mockFetch([{ path: '/srtm/catalogos', body: {} }])
    type Fila = { id: string; nombre: string; area: number; estado: string }
    const filas: Fila[] = [
      { id: 'f1', nombre: 'PRIMERO', area: 120.5, estado: 'ACTIVO' },
      { id: 'f2', nombre: 'SEGUNDO', area: 80, estado: 'INACTIVO' }
    ]
    const api = { listar: async () => filas, agregar: async (_: string, f: Fila) => f, actualizar: async (_: string, f: Fila) => f, borrar: async () => {} }
    renderIn(
      'portal-tributario',
      <HijosPanel<Fila>
        parent="x"
        api={api}
        queryKey="filas"
        plural="filas"
        singular="fila"
        sections={[]}
        catalog="relacionado"
        nuevo={() => ({ id: '', nombre: '', area: 0, estado: 'ACTIVO' })}
        columns={[
          { label: 'Nombre', render: (f) => f.nombre },
          { label: 'Área', render: (f) => formatNumber(f.area), numeric: true }
        ]}
      />
    )
    const grid = await screen.findByRole('grid', { name: 'Listado de filas' })
    expect(grid).toHaveAttribute('data-slot', 'table')
    const [head, primera, segunda] = within(grid).getAllByRole('row')
    expect(numericas(head).map((th) => th.textContent)).toEqual(['Área'])
    expect(numericas(primera).map((td) => td.textContent)).toEqual([formatNumber(120.5)])
    for (const cell of [...numericas(head), ...numericas(primera)]) expect(cell).toHaveClass('text-right', 'tabular-nums')
    expect(within(primera).getByText('Activo')).toHaveAttribute('data-tono', 'verde')
    expect(within(segunda).getByText('Inactivo')).toHaveAttribute('data-tono', 'rojo')
    expect(screen.getByText('1 a 2 de 2 registros').closest('[data-ui="paginador"]')).toBeInTheDocument()
  })
})

describe('the paginators', () => {
  it('are hooked for the theme', () => {
    renderIn(
      'light',
      <>
        <Pagination page={0} totalPages={3} totalElements={47} onPage={() => {}} />
        <Paginador page={0} size={10} total={47} onPage={() => {}} onSize={() => {}} />
      </>
    )
    expect(screen.getByText('Página 1 de 3').closest('[data-ui="paginador"]')).toBeInTheDocument()
    expect(screen.getByText('1 a 10 de 47 registros').closest('[data-ui="paginador"]')).toBeInTheDocument()
  })
})

describe('the read-only ficha', () => {
  it('is a key-value list the theme can stripe', () => {
    renderIn(
      'light',
      <FieldGrid
        sections={[
          {
            id: 'datos',
            title: 'Datos',
            fields: [
              { name: 'nombres', label: 'Nombres', kind: 'text' },
              { name: 'apellido_paterno', label: 'Apellido paterno', kind: 'text' }
            ]
          }
        ]}
        values={{ nombres: 'JUAN', apellido_paterno: 'QUISPE' }}
      />
    )
    const ficha = screen.getByText('Nombres').closest('dl')
    expect(ficha).toHaveAttribute('data-ui', 'ficha-kv')
    expect(within(ficha!).getByText('QUISPE').tagName).toBe('DD')
  })

  it('marks each section and its title, so the theme can draw them as a group with its title on the border', () => {
    renderIn(
      'light',
      <FieldGrid
        sections={[{ id: 'datos', title: 'Datos', number: 1, fields: [{ name: 'nombres', label: 'Nombres', kind: 'text' }] }]}
        values={{ nombres: 'JUAN' }}
      />
    )
    const titulo = screen.getByRole('heading', { name: /Datos/ })
    expect(titulo).toHaveAttribute('data-ui', 'ficha-titulo')
    expect(titulo.closest('section')).toHaveAttribute('data-ui', 'ficha-seccion')
  })
})
