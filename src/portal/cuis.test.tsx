import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { claves } from './queries'
import type { CatalogoCuis, Cuis } from './types'

// el CUIS vigente a una fecha (épica de infracciones administrativas, PR U1): la multa de cada código a la UIT de ese
// día tal como la cifra el backend (nunca base × % en la pantalla), con la UIT y su fecha; sin UIT, una Alert nombra
// lo que falta y ninguna multa es un 0. un código no se edita: una versión nueva, con observación y permiso de
// creación, cierra la vigente. el grupo Infracciones administrativas del menú. códigos, UIT y multas FICTICIOS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dmy = (iso: string) => iso.split('-').reverse().join('/')

const base = (permisos: unknown = { admin: true, objects: {} }, theme = 'system'): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme, locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const codigo = (valores: Partial<Cuis> = {}): Cuis => ({
  id: 'k1',
  familia: 'ADMINISTRATIVA',
  codigo: 'X-001',
  descripcion: 'Infracción ficticia de prueba',
  materia: 'Materia ficticia',
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
  // the backend's: not 10 % nor 20 % of the UIT on purpose, so a multa computed on screen would show
  multa: 123.45,
  multa_segunda: 234.56,
  multa_tercera: null,
  ...valores
})

const catalogo = (valores: Partial<CatalogoCuis> = {}): CatalogoCuis => ({
  vigentes_a: hoy(),
  uit: { valor: 1000, anio: year, parametro_id: 'p-uit' },
  faltan: [],
  codigos: [codigo()],
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

function start(routes: MockRoute[], { permisos, theme }: { permisos?: unknown; theme?: string } = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  if (theme) localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', '/infracciones/cuis')
  fetch = mockFetch([...routes, ...base(permisos, theme)])
  render(<PortalApp />)
}

const tabla = () => screen.findByRole('table', { name: `CUIS vigente al ${dmy(hoy())}` })
const lecturas = () => fetch!.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/srtm/infracciones/cuis'))

describe('CUIS', () => {
  it('shows the backend multa even when it is not base × %, with the UIT and its date', async () => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }])
    const t = await tabla()
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Código', 'Infracción', '% UIT', 'Multa S/', '2ª vez', '3ª vez', 'Medida', 'Vigencia', 'Base legal', 'Acciones'])
    const [, fila] = within(t).getAllByRole('row')
    const celdas = within(fila)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(celdas[0]).toBe('X-001')
    expect(celdas[2]).toBe('10 %')
    expect(celdas[3]).toMatch(/^123[.,]45$/)
    expect(celdas[4]).toMatch(/^234[.,]56$/)
    // 10 % and 20 % of the UIT are not on screen: the amounts are the backend's
    expect(fila.textContent).not.toMatch(/100[.,]00|200[.,]00/)
    // the third time has no % in the CUIS: it says so, no 0
    expect(within(fila).getByTitle('El CUIS no fija el % de esta vez')).toBeInTheDocument()
    expect(celdas[7]).toBe(`01/01/${year} – en adelante`)
    expect(celdas[8]).toBe('Ordenanza ficticia 000')
    expect(screen.getByTestId('uit-aplicada')).toHaveTextContent(new RegExp(`Multas a la UIT ${year} \\(S/\\s?1,000[.,]00\\), vigente al ${dmy(hoy())}`))
    // asked for today by default
    expect(new URLSearchParams(lecturas()[0].path.split('?')[1]).get('vigentes_a')).toBe(hoy())
  })

  it('names the missing UIT with an Alert and shows no 0', async () => {
    const sinUit = catalogo({ uit: null, faltan: [`UIT ${year}`], codigos: [codigo({ multa: null, multa_segunda: null, multa_tercera: null })] })
    start([{ path: '/srtm/infracciones/cuis', body: sinUit }])
    const t = await tabla()
    expect(screen.getByText(`Al ${dmy(hoy())} falta:`).parentElement).toHaveTextContent(`UIT ${year}. Sin eso no se cifran las multas.`)
    expect(screen.queryByTestId('uit-aplicada')).not.toBeInTheDocument()
    expect(t.textContent).not.toMatch(/\b0[.,]00\b/)
    expect(within(t).getAllByTitle('Sin UIT a la fecha')).toHaveLength(2)
  })

  it('filters by date, materia and text', async () => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }])
    await tabla()
    fireEvent.change(screen.getByLabelText('Vigentes al'), { target: { value: `${year}-02-15` } })
    await userEvent.type(screen.getByLabelText('Materia'), ' Comercio ')
    await userEvent.type(screen.getByLabelText('Código o descripción'), 'X-0')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(lecturas()).toHaveLength(2))
    const params = new URLSearchParams(lecturas()[1].path.split('?')[1])
    expect(Object.fromEntries(params)).toEqual({ vigentes_a: `${year}-02-15`, materia: 'Comercio', q: 'X-0' })
  })

  it('keeps its queries under the infracciones keys', () => {
    expect(claves.infracciones).toEqual(['infracciones'])
    expect(claves.cuis({ vigentes_a: `${year}-02-15`, q: 'X' })).toEqual(['infracciones', 'cuis', `${year}-02-15`, null, 'X'])
  })

  it('writes a new version with its observación, shows the one it closed and reads the catalog again', async () => {
    const creada = {
      ...codigo({ id: 'k2', porcentaje_uit: 12, vigencia_desde: `${year}-07-01`, clave: `ADMINISTRATIVA|X-001|${year}-07-01` }),
      cerrada: codigo({ vigencia_hasta: `${year}-06-30`, clave_vigente: null })
    }
    start([
      { method: 'POST', path: '/srtm/infracciones/cuis', status: 201, body: creada },
      { path: '/srtm/infracciones/cuis', body: catalogo() }
    ])
    await tabla()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva versión de X-001' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva versión de X-001' })
    const crear = within(dialogo).getByRole('button', { name: 'Crear versión' })
    expect(within(dialogo).getByLabelText('Código')).toHaveValue('X-001')
    expect(crear).toBeDisabled()
    const porcentaje = within(dialogo).getByLabelText('% UIT')
    await userEvent.clear(porcentaje)
    await userEvent.type(porcentaje, '12')
    fireEvent.change(within(dialogo).getByLabelText('Vigente desde'), { target: { value: `${year}-07-01` } })
    // the observación is still missing
    expect(crear).toBeDisabled()
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Ordenanza ficticia nueva')
    expect(within(dialogo).getByText('Por qué se versiona: de 5 a 500 caracteres (24).')).toBeInTheDocument()
    const antes = lecturas().length
    await userEvent.click(crear)

    expect(await within(dialogo).findByRole('status')).toHaveTextContent(
      `Versión de X-001 vigente desde el 01/07/${year}. Se cerró la anterior (desde el 01/01/${year}): vigente hasta el 30/06/${year}.`
    )
    const post = fetch!.calls.find((c) => c.method === 'POST')!
    expect(post.body).toEqual({
      familia: 'ADMINISTRATIVA',
      codigo: 'X-001',
      descripcion: 'Infracción ficticia de prueba',
      materia: 'Materia ficticia',
      porcentaje_uit: 12,
      porcentaje_uit_segunda: 20,
      porcentaje_uit_tercera: null,
      medida_complementaria: 'Clausura ficticia',
      base_legal: 'Ordenanza ficticia 000',
      vigencia_desde: `${year}-07-01`,
      observacion: 'Ordenanza ficticia nueva'
    })
    await waitFor(() => expect(lecturas().length).toBeGreaterThan(antes))
  })

  it('shows the backend refusal inside the dialog, with what is missing', async () => {
    start([
      {
        method: 'POST',
        path: '/srtm/infracciones/cuis',
        status: 422,
        body: { title: 'Unprocessable Content', detail: `La versión debe empezar después del 01/01/${year}`, faltan: [] }
      },
      { path: '/srtm/infracciones/cuis', body: catalogo() }
    ])
    await tabla()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva versión de X-001' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Vigente desde'), { target: { value: `${year}-01-01` } })
    await userEvent.type(within(dialogo).getByLabelText('Observación'), 'Ordenanza ficticia')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear versión' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(`La versión debe empezar después del 01/01/${year}`)
  })

  it('without CREATE on codigo_infraccion the actions are impeded, and say why', async () => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }], { permisos: { admin: false, objects: { codigo_infraccion: ['READ'] } } })
    await tabla()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo código' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Nueva versión de X-001' })).toBeDisabled()
    expect(screen.getByText('Sin permiso: una versión del CUIS pide creación sobre los códigos de infracción.')).toBeInTheDocument()
  })

  it('opens a blank version for a new code', async () => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }])
    await tabla()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo código' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo código del CUIS' })
    expect(within(dialogo).getByLabelText('Código')).toHaveValue('')
    expect(within(dialogo).getByLabelText('Código')).not.toHaveAttribute('readonly')
  })
})

describe('CUIS en los dos temas', () => {
  it.each(['light', 'portal-tributario'])('shows the same table and the backend multa with %s', async (theme) => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }], { theme })
    const t = await tabla()
    expect(within(t).getAllByRole('row')[1].textContent).toMatch(/123[.,]45/)
    expect(screen.getByRole('navigation', { name: 'Infracciones administrativas' })).toBeInTheDocument()
  })
})

describe('menú de infracciones administrativas', () => {
  it('the classic menu has one entry, current on the CUIS, and the subnav links its pages', async () => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }], { theme: 'light' })
    await tabla()
    const lateral = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(lateral).getByRole('link', { name: 'Infracciones' })).toHaveAttribute('aria-current', 'page')
    const subnav = screen.getByRole('navigation', { name: 'Infracciones administrativas' })
    expect(within(subnav).getByRole('link', { name: 'CUIS' })).toHaveAttribute('href', '/infracciones/cuis')
  })

  it('the rail has the group between Arbitrios and Emisión, marked, and its panel the CUIS leaf current', async () => {
    start([{ path: '/srtm/infracciones/cuis', body: catalogo() }], { theme: 'portal-tributario' })
    await tabla()
    const riel = screen.getByRole('navigation', { name: 'Secciones' })
    const grupos = within(riel)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => ['Arbitrios', 'Infracciones', 'Emisión'].includes(t ?? ''))
    expect(grupos).toEqual(['Arbitrios', 'Infracciones', 'Emisión'])
    const grupo = within(riel).getByRole('button', { name: 'Infracciones' })
    expect(grupo).toHaveAttribute('aria-current', 'true')
    await userEvent.click(grupo)
    const panel = screen.getByRole('navigation', { name: 'Trámites: Infracciones administrativas' })
    expect(within(panel).getByRole('link', { name: 'CUIS' })).toHaveAttribute('aria-current', 'page')
  })
})
