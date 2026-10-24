import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'

// el arancel de la DJ por su tramo de vía (wasichai/srtm-backend#188, srtm-ui#125): un combobox de los aranceles
// VIGENTES del año de la DJ guarda id_aranc, y el arancel queda de solo lectura con el valor del tramo. cifras FICTICIAS

// jsdom has no webgl
vi.mock('./components/LotesMap', () => ({ LotesMap: () => <div data-testid="lotes-map" /> }))

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const titular = { id: 'c1', tipo_documento: 'DNI', numero_documento: '00000001', nombre_completo: 'PRUEBA FICTICIA ANA' }
const predio = { id: 'p1', codigo: '99-01-0001', direccion: 'JR. FICTICIO 100', tipo_predio: 'PREDIO URBANO' }
const declaracion = (valores: Record<string, unknown> = {}) => ({
  id: 'd1',
  contribuyente: 'c1',
  predio: 'p1',
  anio: year,
  secuencia_uso: '001',
  numero_declaracion: 90001,
  clase_uso: 'RESIDENCIAL',
  sub_clase_uso: 'UNIFAMILIAR',
  uso: 'CASA HABITACIÓN',
  area_terreno: 120,
  valor_autoavaluo: 30000,
  estado: 'VIGENTE',
  id_aranc: null,
  ...valores
})
const ficha = (d: object) => ({ declaracion: d, predio, contribuyente: titular, actualizado: `${year}-09-25T14:03:00Z`, autoavaluo_manual: false })

const arancel = (valores: Record<string, unknown>) => ({
  id: 'a1',
  clave: `ZZ-01|${year}`,
  id_aranc: 'ZZ-01',
  anio: year,
  valor_m2: 21.5,
  cod_via: 'V900',
  cuadra: '3',
  lado: 'I',
  norma: null,
  fuente: null,
  transcribio: 'uno@demo.test',
  verifico: 'dos@demo.test',
  estado: 'VIGENTE',
  motivo_anulacion: null,
  anulado_por: null,
  anulado_en: null,
  sincronizado_en: null,
  error_sincronizacion: null,
  ...valores
})
const pagina = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const ARANCELES = '/srtm/normativa/aranceles'

const base = (d: object, permisos: unknown): MockRoute[] => [
  { path: '/auth/me/permissions', body: permisos },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/declaraciones/d1', body: ficha(d) },
  { path: /^\/srtm\/declaraciones\/d1\/(transferentes|niveles|obras|frentes)$/, body: [] },
  { path: '/srtm/predios/p1/declaraciones', body: [{ declaracion: d, predio: null, contribuyente: titular }] }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start(d: object, extra: MockRoute[] = [], permisos: unknown = { admin: true, objects: {} }, tab = 'caracteristicas') {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', `/declaraciones/d1?tab=${tab}`)
  fetch = mockFetch([...extra, ...base(d, permisos)])
  render(<PortalApp />)
}

const puts = () => fetch!.calls.filter((c) => c.method === 'PUT' && c.path === '/srtm/declaraciones/d1')
// es-PE writes S/ and the figure with a no-break space
const valor = (campo: HTMLElement) => (campo as HTMLInputElement).value.replace(/\s/g, ' ')
const guardar = () => userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
// a paragraph by its whole text, with es-PE's no-break spaces read as spaces
const parrafo = (texto: string) => (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent?.replace(/\s/g, ' ') === texto

describe('el arancel de la DJ', () => {
  it('picks the tramo among the year’s VIGENTE aranceles, shows its arancel read-only, and saves id_aranc', async () => {
    start(declaracion(), [
      { path: ARANCELES, body: pagina([arancel({}), arancel({ id: 'a2', id_aranc: 'ZZ-02', valor_m2: 18, cuadra: '4' })]) },
      { method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion({ id_aranc: 'ZZ-01' }) }
    ])
    const combo = await screen.findByRole('combobox', { name: 'Tramo de vía (id_aranc)' })
    await userEvent.type(combo, 'ZZ')
    const opciones = await within(await screen.findByRole('listbox', { name: 'Aranceles vigentes' })).findAllByRole('option')
    expect(opciones[0]).toHaveTextContent('ZZ-01')
    expect(opciones[0]).toHaveTextContent('vía V900 · cuadra 3 · lado I')
    expect(opciones[0]).toHaveTextContent('S/ 21.50')
    expect(fetch!.calls.map((c) => c.path)).toContain(`${ARANCELES}?anio=${year}&estado=VIGENTE&q=ZZ&page=0&size=20`)

    await userEvent.click(opciones[0])
    const campo = screen.getByLabelText('Arancel (S/ por m²)')
    expect(campo).toBeDisabled()
    expect(valor(campo)).toBe('S/ 21.50')
    expect(screen.getByText(/del arancel ZZ-01/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Tramo de vía (id_aranc)' })).not.toBeInTheDocument()

    await guardar()
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body).toMatchObject({ id: 'd1', id_aranc: 'ZZ-01' })
  })

  it('shows a stored tramo’s arancel, sends id_aranc on a save of something else, and «Quitar tramo» makes it manual', async () => {
    start(declaracion({ id_aranc: 'ZZ-01' }), [
      { path: ARANCELES, body: pagina([arancel({})]) },
      { method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion({ id_aranc: 'ZZ-01' }) }
    ])
    const campo = await screen.findByLabelText('Arancel (S/ por m²)')
    await waitFor(() => expect(valor(campo)).toBe('S/ 21.50'))
    expect(fetch!.calls.map((c) => c.path)).toContain(`${ARANCELES}?anio=${year}&estado=VIGENTE&q=ZZ-01&page=0&size=20`)

    const area = screen.getByLabelText(/Área del terreno/)
    await userEvent.clear(area)
    await userEvent.type(area, '130')
    await guardar()
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body).toMatchObject({ area_terreno: 130, id_aranc: 'ZZ-01' })

    await userEvent.click(screen.getByRole('button', { name: 'Quitar tramo' }))
    expect(await screen.findByRole('combobox', { name: 'Tramo de vía (id_aranc)' })).toBeInTheDocument()
    await guardar()
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(puts()[1].body).toMatchObject({ id_aranc: null })
  })

  it('says when the stored tramo’s arancel cannot be read, not that it has none', async () => {
    start(declaracion({ id_aranc: 'ZZ-01' }), [{ path: ARANCELES, status: 403, body: { title: 'Forbidden' } }])
    const campo = await screen.findByLabelText('Arancel (S/ por m²)')
    await waitFor(() => expect(campo).toHaveAttribute('placeholder', 'no se pudo leer el arancel del tramo'))
  })

  it('shows the backend’s 400 on id_aranc under the field', async () => {
    const mensaje = `no hay un arancel VIGENTE ZZ-01 para ${year}`
    start(declaracion(), [
      { path: ARANCELES, body: pagina([arancel({})]) },
      {
        method: 'PUT',
        path: '/srtm/declaraciones/d1',
        status: 400,
        body: { title: 'Bad Request', detail: 'Datos inválidos', errors: [{ field: 'id_aranc', message: mensaje }] }
      }
    ])
    await userEvent.type(await screen.findByRole('combobox', { name: 'Tramo de vía (id_aranc)' }), 'ZZ')
    await userEvent.click((await within(await screen.findByRole('listbox', { name: 'Aranceles vigentes' })).findAllByRole('option'))[0])
    await guardar()
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(screen.getByLabelText('Arancel (S/ por m²)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('offers no combobox to who may not read aranceles: the arancel stays manual', async () => {
    const todo = ['READ', 'CREATE', 'UPDATE', 'DELETE']
    start(declaracion(), [], { admin: false, objects: { declaracion_predial: todo, predio: todo, contribuyente: todo } })
    expect(await screen.findByLabelText(/Área del terreno/)).toBeInTheDocument()
    const valores = screen.getByText('Valores').closest('fieldset')!
    expect(within(valores).getByLabelText(/Autoavalúo/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Tramo de vía (id_aranc)' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Arancel (S/ por m²)')).not.toBeInTheDocument()
    expect(fetch!.calls.filter((c) => c.path.startsWith(ARANCELES))).toHaveLength(0)
  })

  // the arancel stored on the DJ (srtm-backend#195, srtm-ui#129)
  describe('el arancel guardado', () => {
    it('shows the stored figure of a DJ with its tramo, «del arancel <id_aranc>», with no notice while it agrees', async () => {
      start(declaracion({ id_aranc: 'ZZ-01', arancel: 21.5 }), [{ path: ARANCELES, body: pagina([arancel({})]) }])
      const campo = await screen.findByLabelText('Arancel (S/ por m²)')
      await waitFor(() => expect(valor(campo)).toBe('S/ 21.50'))
      expect(await screen.findByText(parrafo('del arancel ZZ-01 (vía V900 · cuadra 3 · lado I)'))).toBeInTheDocument()
      expect(screen.queryByText(/valor vigente del tramo/)).not.toBeInTheDocument()
      expect(screen.queryByText(/se tomará al guardar o con Recalcular/)).not.toBeInTheDocument()
    })

    it('keeps the stored figure and tells when the tramo’s VIGENTE arancel is another', async () => {
      start(declaracion({ id_aranc: 'ZZ-01', arancel: 19 }), [{ path: ARANCELES, body: pagina([arancel({})]) }])
      const campo = await screen.findByLabelText('Arancel (S/ por m²)')
      expect(await screen.findByText(parrafo('El arancel vigente del tramo es S/ 21.50: se tomará al guardar o con Recalcular'))).toBeInTheDocument()
      expect(valor(campo)).toBe('S/ 19.00')
    })

    it('shows the stored figure when the tramo has no VIGENTE arancel any more (annulled)', async () => {
      start(declaracion({ id_aranc: 'ZZ-01', arancel: 19 }), [{ path: ARANCELES, body: pagina([]) }])
      const campo = await screen.findByLabelText('Arancel (S/ por m²)')
      expect(await screen.findByText(parrafo(`sin arancel VIGENTE en ${year}: se conserva el guardado (S/ 19.00)`))).toBeInTheDocument()
      expect(valor(campo)).toBe('S/ 19.00')
    })

    it('shows the stored figure of a DJ without tramo, read-only, beside the combobox; nothing when it is null', async () => {
      start(declaracion({ arancel: 17.25 }))
      expect(await screen.findByRole('combobox', { name: 'Tramo de vía (id_aranc)' })).toBeInTheDocument()
      expect(screen.getByText(parrafo('Arancel de la declaración: S/ 17.25 por m²'))).toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /Arancel de la declaración/ })).not.toBeInTheDocument()
    })

    it('shows no figure of a DJ without tramo whose arancel is null', async () => {
      start(declaracion({ arancel: null }))
      expect(await screen.findByRole('combobox', { name: 'Tramo de vía (id_aranc)' })).toBeInTheDocument()
      expect(screen.queryByText(/Arancel de la declaración/)).not.toBeInTheDocument()
    })

    it('never sends the stored arancel back on a save', async () => {
      start(declaracion({ id_aranc: 'ZZ-01', arancel: 19 }), [
        { path: ARANCELES, body: pagina([arancel({})]) },
        { method: 'PUT', path: '/srtm/declaraciones/d1', body: declaracion({ id_aranc: 'ZZ-01', arancel: 19 }) }
      ])
      const area = await screen.findByLabelText(/Área del terreno/)
      await userEvent.clear(area)
      await userEvent.type(area, '130')
      await guardar()
      await waitFor(() => expect(puts()).toHaveLength(1))
      expect(puts()[0].body).toMatchObject({ area_terreno: 130, id_aranc: 'ZZ-01' })
      expect(puts()[0].body).not.toHaveProperty('arancel')
    })

    it('without the stored arancel (an older backend), shows the VIGENTE one’s figure as before, with no notice', async () => {
      start(declaracion({ id_aranc: 'ZZ-01' }), [{ path: ARANCELES, body: pagina([arancel({ valor_m2: 23 })]) }])
      const campo = await screen.findByLabelText('Arancel (S/ por m²)')
      await waitFor(() => expect(valor(campo)).toBe('S/ 23.00'))
      expect(screen.getByText(/del arancel ZZ-01: valor vigente del tramo/)).toBeInTheDocument()
      expect(screen.queryByText(/se tomará al guardar o con Recalcular/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Arancel de la declaración/)).not.toBeInTheDocument()
    })
  })

  // M2 of srtm-ui#127's review: the combobox searches by the año being edited in Datos
  describe('el año del combobox', () => {
    const otroAnio = year + 1
    const cambiarAnio = async () => {
      const anio = await screen.findByLabelText(/^Año/)
      await userEvent.clear(anio)
      await userEvent.type(anio, String(otroAnio))
      await userEvent.click(screen.getByRole('tab', { name: /Características/ }))
    }

    it('searches with the año typed in Datos, not the stored one', async () => {
      start(declaracion(), [{ path: ARANCELES, body: pagina([arancel({ anio: otroAnio })]) }], undefined, 'datos')
      await cambiarAnio()
      await userEvent.type(await screen.findByRole('combobox', { name: 'Tramo de vía (id_aranc)' }), 'ZZ')
      await screen.findByRole('listbox', { name: 'Aranceles vigentes' })
      const busquedas = fetch!.calls.filter((c) => c.path.startsWith(ARANCELES)).map((c) => c.path)
      expect(busquedas).toContain(`${ARANCELES}?anio=${otroAnio}&estado=VIGENTE&q=ZZ&page=0&size=20`)
      expect(busquedas.some((p) => p.includes(`anio=${year}&`))).toBe(false)
    })

    it('tells in the field, before saving, that the tramo has no VIGENTE arancel in the new año', async () => {
      start(
        declaracion({ id_aranc: 'ZZ-01', arancel: 21.5 }),
        [
          { path: new RegExp(`^${ARANCELES}\\?anio=${otroAnio}&`), body: pagina([]) },
          { path: ARANCELES, body: pagina([arancel({})]) }
        ],
        undefined,
        'datos'
      )
      await cambiarAnio()
      expect(
        await screen.findByText(parrafo(`El tramo ZZ-01 no tiene arancel VIGENTE en ${otroAnio}: elija otro tramo o quítelo antes de guardar`))
      ).toBeInTheDocument()
      expect(puts()).toHaveLength(0)
    })

    it('tells that the save takes the new año’s VIGENTE figure, not Recalcular, when the año changed', async () => {
      start(
        declaracion({ id_aranc: 'ZZ-01', arancel: 21.5 }),
        [
          { path: new RegExp(`^${ARANCELES}\\?anio=${otroAnio}&`), body: pagina([arancel({ anio: otroAnio, valor_m2: 24 })]) },
          { path: ARANCELES, body: pagina([arancel({})]) }
        ],
        undefined,
        'datos'
      )
      await cambiarAnio()
      expect(await screen.findByText(parrafo(`Al guardar se tomará S/ 24.00 (arancel vigente del tramo en ${otroAnio})`))).toBeInTheDocument()
      expect(screen.queryByText(/se tomará al guardar o con Recalcular/)).not.toBeInTheDocument()
      expect(valor(screen.getByLabelText('Arancel (S/ por m²)'))).toBe('S/ 21.50')
    })
  })
})
