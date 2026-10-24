import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// Normativa (wasichai/srtm-backend#186, srtm-ui#125): los parámetros y los aranceles con doble firma, cada pestaña
// para quien lee su objeto; la copia de los aranceles a catastro. cifras, normas y personas FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const year = new Date().getFullYear()
const ana = { id: 'u1', email: 'ana@demo.test', displayName: 'Ana Prueba', organizationId: 'o1', roles: ['NORMATIVA'] }
const TODO = ['READ', 'CREATE', 'UPDATE', 'DELETE']
const normativaCompleta = { admin: false, objects: { parametro_tributario: TODO, arancel: TODO } }

const base = (permisos: unknown): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } }
]

const tipos = [
  { tipo: 'UIT', etiqueta: 'Unidad impositiva tributaria', usa_clave: false, valor: 'NUMERICO', unidad: 'S/', modulo: 'impuesto', admite_vacio: false },
  { tipo: 'PLAZO', etiqueta: 'Plazo', usa_clave: true, valor: 'NUMERICO', unidad: 'días', modulo: 'sanciones', admite_vacio: false }
]

const parametro = (valores: Record<string, unknown>) => ({
  id: 'p1',
  tipo: 'UIT',
  clave: null,
  vigencia_desde: `${year}-01-01`,
  vigencia_hasta: null,
  valor_numerico: 1234,
  texto: null,
  norma: 'DS ficticio 001',
  fuente: null,
  transcribio: 'otro@demo.test',
  verifico: 'tercera@demo.test',
  estado: 'VIGENTE',
  motivo_anulacion: null,
  anulado_por: null,
  anulado_en: null,
  ...valores
})

const arancel = (valores: Record<string, unknown>) => ({
  id: 'a1',
  clave: `ZZ-01|${year}`,
  id_aranc: 'ZZ-01',
  anio: year,
  valor_m2: 21.5,
  cod_via: 'V900',
  cuadra: '1',
  lado: 'D',
  norma: 'Ordenanza ficticia 9',
  fuente: null,
  transcribio: 'otro@demo.test',
  verifico: 'tercera@demo.test',
  estado: 'VIGENTE',
  motivo_anulacion: null,
  anulado_por: null,
  anulado_en: null,
  sincronizado_en: null,
  error_sincronizacion: null,
  ...valores
})

const pagina = (content: unknown[], extra: Record<string, unknown> = {}) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
  ...extra
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
})

function start(path: string, routes: MockRoute[], permisos: unknown = normativaCompleta) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(ana))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...routes, ...base(permisos)])
  render(<PortalApp />)
}

const llamadas = (method: string, path: string) => fetch!.calls.filter((c) => c.method === method && c.path.split('?')[0] === path)
const sidebar = () => screen.getByRole('navigation', { name: 'Secciones' })

describe('el menú', () => {
  it('shows Normativa to who may read parámetros or aranceles', async () => {
    start('/', [], { admin: false, objects: { arancel: ['READ'] } })
    expect(await within(sidebar()).findByRole('link', { name: 'Normativa' })).toHaveAttribute('href', '/normativa')
  })

  it('hides it from who may read neither', async () => {
    start('/', [], { admin: false, objects: { predio: ['READ'], arancel: ['CREATE'] } })
    await waitFor(() => expect(llamadas('GET', '/auth/me/permissions').length).toBeGreaterThan(0))
    await within(sidebar()).findByRole('link', { name: 'Predios' })
    expect(within(sidebar()).queryByRole('link', { name: 'Normativa' })).not.toBeInTheDocument()
  })

  it('opens only the tabs whose object it may read', async () => {
    start('/normativa', [{ path: '/srtm/normativa/aranceles', body: pagina([]) }], { admin: false, objects: { arancel: ['READ'] } })
    expect(await screen.findByRole('tab', { name: /Aranceles/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Parámetros/ })).not.toBeInTheDocument()
    expect(llamadas('GET', '/srtm/normativa/parametros')).toHaveLength(0)
  })
})

describe('parámetros', () => {
  const rutas = (lista: unknown[], extra: MockRoute[] = []): MockRoute[] => [
    { path: '/srtm/normativa/tipos', body: tipos },
    { path: '/srtm/normativa/parametros', body: lista },
    ...extra
  ]

  it('lists them with the catalog label, the unit and an open vigencia, and filters by tipo, estado and vigente en', async () => {
    start('/normativa?tab=parametros', rutas([parametro({})]))
    const tabla = await screen.findByRole('table', { name: 'Parámetros tributarios' })
    const fila = within(tabla).getAllByRole('row')[1]
    expect(fila).toHaveTextContent('Unidad impositiva tributaria')
    expect(fila).toHaveTextContent('1,234 S/')
    expect(fila).toHaveTextContent('abierta')
    expect(within(fila).getByText('Vigente')).toHaveAttribute('data-tono', 'verde')

    const filtros = screen.getByRole('search', { name: 'Filtros de parámetros' })
    await userEvent.selectOptions(within(filtros).getByLabelText('Tipo'), 'UIT')
    await userEvent.selectOptions(within(filtros).getByLabelText('Estado'), 'POR_VERIFICAR')
    await userEvent.type(within(filtros).getByLabelText('Vigente en'), `${year}-03-15`)
    await userEvent.click(within(filtros).getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(llamadas('GET', '/srtm/normativa/parametros').map((c) => c.path)).toContain(
        `/srtm/normativa/parametros?tipo=UIT&estado=POR_VERIFICAR&vigente_en=${year}-03-15`
      )
    )
  })

  it('verifies the ones picked: the user’s own cannot be picked, and each rechazo shows its motivo', async () => {
    const propio = parametro({ id: 'p1', estado: 'POR_VERIFICAR', verifico: null, transcribio: 'ANA@DEMO.TEST, Ana' })
    const ajeno = parametro({ id: 'p2', tipo: 'PLAZO', clave: 'DESCARGO', estado: 'POR_VERIFICAR', verifico: null, valor_numerico: 5 })
    const motivo = `se solapa con PLAZO DESCARGO ${year}-01-01..${year}-12-31, VIGENTE (p9): anúlelo antes, o corrija la vigencia`
    start(
      '/normativa',
      rutas([propio, ajeno], [{ method: 'POST', path: '/srtm/normativa/parametros/verificar', body: { verificados: [], rechazados: [{ id: 'p2', motivo }] } }])
    )
    const casillaPropia = await screen.findByRole('checkbox', { name: /Unidad impositiva tributaria/ })
    expect(casillaPropia).toBeDisabled()
    expect(casillaPropia.parentElement).toHaveAttribute('title', 'La doble firma pide otra persona')
    const verificar = screen.getByRole('button', { name: /^Verificar/ })
    expect(verificar).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /Plazo DESCARGO/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Verificar (1)' }))
    await waitFor(() => expect(llamadas('POST', '/srtm/normativa/parametros/verificar')).toHaveLength(1))
    expect(llamadas('POST', '/srtm/normativa/parametros/verificar')[0].body).toEqual({ ids: ['p2'] })
    const rechazos = await screen.findByRole('list', { name: 'Rechazos de la verificación' })
    expect(rechazos).toHaveTextContent(`Plazo DESCARGO desde 01/01/${year}: ${motivo}`)
  })

  it('imports a csv as a dry run first, and writes it only on Confirmar', async () => {
    const vista = {
      dry_run: true,
      crear: [
        {
          fila: 2,
          id: null,
          tipo: 'UIT',
          clave: null,
          vigencia_desde: `${year + 1}-01-01`,
          vigencia_hasta: null,
          valor_numerico: 1300,
          texto: null,
          estado: 'POR_VERIFICAR'
        }
      ],
      actualizar: [],
      iguales: 3,
      rechazos: [{ fila: 5, motivo: 'vigencia_desde: no es una fecha' }]
    }
    start('/normativa', rutas([], [{ method: 'POST', path: '/srtm/normativa/parametros/importar', body: vista }]))
    await userEvent.click(await screen.findByRole('button', { name: 'Importar CSV' }))
    const dialogo = await screen.findByRole('dialog')
    const archivo = new File([`tipo,vigencia_desde,valor_numerico\nUIT,${year + 1}-01-01,1300\n`], 'parametros.csv', { type: 'text/csv' })
    await userEvent.upload(within(dialogo).getByLabelText('Archivo CSV'), archivo)

    const previa = await within(dialogo).findByRole('region', { name: 'Vista previa de la importación' })
    expect(previa).toHaveTextContent('Crear1')
    expect(previa).toHaveTextContent('Iguales3')
    expect(within(previa).getByRole('table', { name: 'Rechazos de la importación' })).toHaveTextContent('5vigencia_desde: no es una fecha')
    let importaciones = llamadas('POST', '/srtm/normativa/parametros/importar')
    expect(importaciones.map((c) => c.path)).toEqual(['/srtm/normativa/parametros/importar?dry_run=true'])
    expect(importaciones[0].headers['content-type']).toBe('text/csv')

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(await within(dialogo).findByText(/Importado: 1 creado/)).toBeInTheDocument()
    importaciones = llamadas('POST', '/srtm/normativa/parametros/importar')
    expect(importaciones.map((c) => c.path)).toEqual(['/srtm/normativa/parametros/importar?dry_run=true', '/srtm/normativa/parametros/importar?dry_run=false'])
  })

  it('reads the list again after Confirmar even when the import fails midway', async () => {
    const vista = {
      dry_run: true,
      crear: [
        {
          fila: 2,
          id: null,
          tipo: 'UIT',
          clave: null,
          vigencia_desde: `${year + 1}-01-01`,
          vigencia_hasta: null,
          valor_numerico: 1300,
          texto: null,
          estado: 'POR_VERIFICAR'
        }
      ],
      actualizar: [],
      iguales: 1,
      rechazos: []
    }
    start(
      '/normativa',
      rutas(
        [],
        [
          { method: 'POST', path: /importar\?dry_run=false/, status: 409, body: { title: 'Conflict', detail: 'escritura parcial' } },
          { method: 'POST', path: /importar\?dry_run=true/, body: vista }
        ]
      )
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Importar CSV' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.upload(within(dialogo).getByLabelText('Archivo CSV'), new File(['tipo\nUIT\n'], 'parametros.csv', { type: 'text/csv' }))
    await within(dialogo).findByRole('region', { name: 'Vista previa de la importación' })
    const antes = llamadas('GET', '/srtm/normativa/parametros').length
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(llamadas('POST', '/srtm/normativa/parametros/importar')).toHaveLength(2))
    await waitFor(() => expect(llamadas('GET', '/srtm/normativa/parametros').length).toBeGreaterThan(antes))
  })

  it('annuls a VIGENTE with the motivo written in its dialog, and offers to close an open vigencia', async () => {
    start(
      '/normativa',
      rutas(
        [parametro({})],
        [{ method: 'POST', path: '/srtm/normativa/parametros/p1/anular', body: parametro({ estado: 'ANULADO', motivo_anulacion: 'Error de transcripción' }) }]
      )
    )
    expect(await screen.findByRole('button', { name: 'Cerrar vigencia' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }))
    const dialogo = await screen.findByRole('dialog')
    const anular = within(dialogo).getByRole('button', { name: 'Anular' })
    expect(anular).toBeDisabled()
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Error de transcripción')
    await userEvent.click(anular)
    await waitFor(() => expect(llamadas('POST', '/srtm/normativa/parametros/p1/anular')).toHaveLength(1))
    expect(llamadas('POST', '/srtm/normativa/parametros/p1/anular')[0].body).toEqual({ motivo: 'Error de transcripción' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes an open vigencia with the date asked in its dialog', async () => {
    start(
      '/normativa',
      rutas([parametro({})], [{ method: 'POST', path: '/srtm/normativa/parametros/p1/cerrar', body: parametro({ vigencia_hasta: `${year}-12-31` }) }])
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar vigencia' }))
    const dialogo = await screen.findByRole('dialog')
    const cerrar = within(dialogo).getByRole('button', { name: 'Cerrar vigencia' })
    expect(cerrar).toBeDisabled()
    await userEvent.type(within(dialogo).getByLabelText(/Vigente hasta/), `${year}-12-31`)
    await userEvent.click(cerrar)
    await waitFor(() => expect(llamadas('POST', '/srtm/normativa/parametros/p1/cerrar')).toHaveLength(1))
    expect(llamadas('POST', '/srtm/normativa/parametros/p1/cerrar')[0].body).toEqual({ vigencia_hasta: `${year}-12-31` })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('registers one with the fields its tipo asks for, and shows the 400 under its field', async () => {
    start(
      '/normativa',
      rutas(
        [],
        [
          {
            method: 'POST',
            path: '/srtm/normativa/parametros',
            status: 400,
            body: { title: 'Bad Request', detail: 'Datos inválidos', errors: [{ field: 'valor_numerico', message: 'debe ser mayor que cero' }] }
          }
        ]
      )
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo parámetro' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).queryByLabelText(/Clave/)).not.toBeInTheDocument()
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Tipo/), 'PLAZO')
    await userEvent.type(within(dialogo).getByLabelText(/Clave/), 'DESCARGO')
    await userEvent.type(within(dialogo).getByLabelText(/^Valor/), '0')
    await userEvent.type(within(dialogo).getByLabelText(/Vigente desde/), `${year}-01-01`)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }))
    expect(await within(dialogo).findByText('debe ser mayor que cero')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/^Valor/)).toHaveAttribute('aria-invalid', 'true')
    expect(llamadas('POST', '/srtm/normativa/parametros')[0].body).toEqual({
      tipo: 'PLAZO',
      clave: 'DESCARGO',
      vigencia_desde: `${year}-01-01`,
      vigencia_hasta: null,
      valor_numerico: 0,
      texto: null,
      norma: null,
      fuente: null
    })
  })

  it('offers no writes without the permissions, saying why', async () => {
    start('/normativa', rutas([parametro({ estado: 'POR_VERIFICAR', verifico: null })]), { admin: false, objects: { parametro_tributario: ['READ'] } })
    expect(await screen.findByRole('button', { name: 'Nuevo parámetro' })).toBeDisabled()
    expect(screen.getByText(/Sin permiso: registrar un parámetro/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeDisabled()
  })
})

describe('aranceles', () => {
  const lista = '/srtm/normativa/aranceles'

  it('pages the year’s aranceles and searches them by q', async () => {
    start('/normativa?tab=aranceles', [{ path: lista, body: pagina([arancel({})], { totalElements: 25, totalPages: 2 }) }])
    expect(await screen.findByRole('table', { name: `Aranceles de ${year}` })).toHaveTextContent('ZZ-01')
    expect(llamadas('GET', lista).map((c) => c.path)).toContain(`${lista}?anio=${year}&page=0&size=20`)

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(llamadas('GET', lista).map((c) => c.path)).toContain(`${lista}?anio=${year}&page=1&size=20`))

    const filtros = screen.getByRole('search', { name: 'Filtros de aranceles' })
    await userEvent.type(within(filtros).getByLabelText('Tramo o vía'), 'V90')
    await userEvent.click(within(filtros).getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(llamadas('GET', lista).map((c) => c.path)).toContain(`${lista}?anio=${year}&q=V90&page=0&size=20`))
  })

  it('says how catastro’s copy stands: sincronizado with its date, error with its text, pendiente', async () => {
    start('/normativa?tab=aranceles', [
      {
        path: lista,
        body: pagina([
          arancel({ id: 'a1', id_aranc: 'ZZ-01', sincronizado_en: `${year}-10-20T15:30:00Z` }),
          arancel({ id: 'a2', id_aranc: 'ZZ-02', error_sincronizacion: 'catastro respondió 502' }),
          arancel({ id: 'a3', id_aranc: 'ZZ-03' }),
          arancel({ id: 'a4', id_aranc: 'ZZ-04', estado: 'POR_VERIFICAR', verifico: null }),
          arancel({ id: 'a5', id_aranc: 'ZZ-05', estado: 'ANULADO', motivo_anulacion: 'Error' })
        ])
      }
    ])
    const tabla = await screen.findByRole('table', { name: `Aranceles de ${year}` })
    const [, uno, dos, tres, cuatro, cinco] = within(tabla).getAllByRole('row')
    expect(uno.querySelector('[data-catastro]')).toHaveAttribute('data-catastro', 'sincronizado')
    expect(uno).toHaveTextContent(`sincronizado 20/10/${year} 10:30`)
    expect(within(dos).getByText('error')).toHaveAttribute('title', 'catastro respondió 502')
    expect(within(tres).getByText('pendiente')).toBeInTheDocument()
    expect(cuatro.querySelector('[data-catastro]')).toBeNull()
    // an ANULADO whose delete in catastro is still to go is pending too
    expect(within(cinco).getByText('pendiente')).toBeInTheDocument()
  })

  it('synchronizes the year with catastro and shows the result', async () => {
    start('/normativa?tab=aranceles', [
      { path: lista, body: pagina([arancel({})]) },
      {
        method: 'POST',
        path: `${lista}/sincronizar`,
        body: { sincronizados: 3, errores: [{ id: 'a2', clave: `ZZ-02|${year}`, error: 'catastro respondió 502' }] }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Sincronizar con catastro' }))
    expect(await screen.findByText(new RegExp(`Sincronización de ${year}: 3 copiados a catastro`))).toBeInTheDocument()
    expect(screen.getByText(`ZZ-02|${year}: catastro respondió 502`)).toBeInTheDocument()
    expect(llamadas('POST', `${lista}/sincronizar`).map((c) => c.path)).toEqual([`${lista}/sincronizar?anio=${year}`])
    // and the table is asked again
    await waitFor(() => expect(llamadas('GET', lista).length).toBeGreaterThan(1))
  })

  // a backend without srtm-backend#189: POST …/sincronizar falls on /{id}, which only has PATCH and DELETE (405)
  it.each([404, 405])('says the synchronization is not there yet when the backend answers %i', async (status) => {
    start('/normativa?tab=aranceles', [
      { path: lista, body: pagina([arancel({})]) },
      { method: 'POST', path: `${lista}/sincronizar`, status, body: { title: status === 404 ? 'Not Found' : 'Method Not Allowed' } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Sincronizar con catastro' }))
    expect(await screen.findByText('La sincronización con catastro aún no está disponible')).toBeInTheDocument()
  })

  it('shows what the copy to catastro did after a verificación, and nothing when it did not run', async () => {
    const porVerificar = arancel({ id: 'a2', id_aranc: 'ZZ-02', estado: 'POR_VERIFICAR', verifico: null })
    start('/normativa?tab=aranceles', [
      { path: lista, body: pagina([porVerificar]) },
      { method: 'POST', path: `${lista}/verificar`, body: { verificados: ['a2'], rechazados: [], sincronizacion: { sincronizados: 1, errores: [] } } }
    ])
    await userEvent.click(await screen.findByRole('checkbox', { name: /ZZ-02/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Verificar (1)' }))
    expect(await screen.findByText('1 verificado.')).toBeInTheDocument()
    expect(screen.getByText('1 copiado a catastro.')).toBeInTheDocument()
  })

  it('without sincronizacion in the answer says nothing of catastro', async () => {
    const porVerificar = arancel({ id: 'a2', id_aranc: 'ZZ-02', estado: 'POR_VERIFICAR', verifico: null })
    start('/normativa?tab=aranceles', [
      { path: lista, body: pagina([porVerificar]) },
      { method: 'POST', path: `${lista}/verificar`, body: { verificados: ['a2'], rechazados: [], sincronizacion: null } }
    ])
    await userEvent.click(await screen.findByRole('checkbox', { name: /ZZ-02/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Verificar (1)' }))
    expect(await screen.findByText('1 verificado.')).toBeInTheDocument()
    expect(screen.queryByText(/a catastro\./)).not.toBeInTheDocument()
  })

  it('deletes a POR_VERIFICAR only after its own confirmation dialog', async () => {
    const confirmar = vi.spyOn(window, 'confirm')
    start('/normativa?tab=aranceles', [
      { path: lista, body: pagina([arancel({ estado: 'POR_VERIFICAR', verifico: null })]) },
      { method: 'DELETE', path: `${lista}/a1`, status: 204 }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(llamadas('DELETE', `${lista}/a1`)).toHaveLength(0)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(llamadas('DELETE', `${lista}/a1`)).toHaveLength(1))
    expect(confirmar).not.toHaveBeenCalled()
  })
})
