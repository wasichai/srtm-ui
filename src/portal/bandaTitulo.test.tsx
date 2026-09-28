import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// the title band of the portal-tributario theme (#55): the fichas and the wizards open with their h1 on the brand and
// what goes with it (badges, the ficha's actions, the wizard's buttons) in a row under it; the folder tabs hang from
// it where they come right after. light keeps the header of always

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const user = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin Rentas', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const contribuyente = {
  id: 'c1',
  codigo: '000012',
  tipo_persona: 'NATURAL',
  tipo_contribuyente: 'PERSONA NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '20529936',
  nombre_completo: 'QUISPE MAMANI JUAN',
  domicilio_fiscal: 'JR. LIMA 123'
}
const predio = { id: 'p1', codigo: '01-01-0001', tipo_predio: 'PREDIO URBANO', direccion: 'JR. LIMA 123', numero_registro: 5243 }
const declaracion = { id: 'd1', contribuyente: 'c1', predio: 'p1', anio: year, secuencia_uso: '1', numero_declaracion: 39147 }
const totales = { declaraciones: 1, autoavaluo: 10080.45, valor_afecto: 8000 }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => fetch?.restore())

// signed in with the theme stored in the browser and for the user
function start(theme: string, path: string) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(user))
  localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', path)
  const routes: MockRoute[] = [
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/auth/me/preferences', body: { theme, locale: null } },
    { path: '/srtm/contribuyentes/c1/declaraciones', body: [] },
    { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
    { path: '/srtm/declaraciones/d1', body: { declaracion, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' } },
    { path: /^\/srtm\/declaraciones\/d1\//, body: [] }
  ]
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const bandaDe = (heading: HTMLElement) => heading.closest<HTMLElement>('[data-ui="banda-titulo"]')
// the row under the band
const filaDe = (heading: HTMLElement) => bandaDe(heading)!.nextElementSibling as HTMLElement
// what follows the header: the box of the folder tabs, which banda.css joins to it
const siguienteA = (heading: HTMLElement) => bandaDe(heading)!.parentElement!.nextElementSibling as HTMLElement

describe('title band: fichas', () => {
  it('shows the contribuyente ficha h1 inside the band, with the badges and the actions under it', async () => {
    start('portal-tributario', '/contribuyentes/c1')
    const titulo = await h1('QUISPE MAMANI JUAN')
    const banda = bandaDe(titulo)!
    expect(banda).toHaveClass('bg-brand', 'text-on-brand')
    expect(banda).toHaveTextContent('Contribuyente Nº 000012')
    const fila = filaDe(titulo)
    expect(within(fila).getByText('PERSONA NATURAL')).toBeVisible()
    expect(within(fila).getByText(/DNI 20529936/)).toBeVisible()
    expect(within(fila).getByRole('combobox', { name: 'Año' })).toBeVisible()
    expect(within(fila).getByRole('button', { name: /Eliminar/ })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('keeps the FichaHeader of always with light', async () => {
    start('light', '/contribuyentes/c1')
    const titulo = await h1('QUISPE MAMANI JUAN')
    expect(bandaDe(titulo)).toBeNull()
    expect(document.querySelector('[data-ui="banda-titulo"]')).toBeNull()
    expect(titulo).toHaveClass('mt-0.5', 'text-xl', 'font-semibold', 'break-words', 'text-ink')
    expect(titulo.previousElementSibling).toHaveTextContent('Contribuyente Nº 000012')
  })

  // the srtm's Cancelar / Guardar and the wizard's Siguiente (#11): under the band, in their order
  it("keeps the declaración's buttons under the band, in their focus order", async () => {
    start('portal-tributario', '/declaraciones/d1?asistente=1')
    const titulo = await h1('Declaración jurada predial - 39147')
    const banda = bandaDe(titulo)!
    // the contribuyente is still a link, in the band
    expect(within(banda).getByRole('link', { name: /Contribuyente Nº 000012 - QUISPE MAMANI JUAN/ })).toHaveAttribute('href', '/contribuyentes/c1')
    const acciones = within(filaDe(titulo)).getByRole('group', { name: 'Acciones de la declaración' })
    expect(
      within(acciones)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Anular declaración', 'Cancelar', 'Guardar', 'Siguiente'])
  })

  it("hangs the declaración's folder tabs from its header", async () => {
    start('portal-tributario', '/declaraciones/d1')
    const titulo = await h1('Declaración jurada predial - 39147')
    expect(siguienteA(titulo).firstElementChild).toHaveAttribute('data-ui', 'ficha-tabs')
  })
})

describe('title band: wizards', () => {
  it.each([
    ['/contribuyentes/nuevo', 'Nuevo contribuyente', 'Insertar contribuyente', null],
    [
      '/contribuyentes/c1/declaraciones/nueva',
      'Nueva declaración jurada predial',
      'Declaración jurada y registro de predio',
      'Contribuyente Nº 000012 - QUISPE MAMANI JUAN'
    ]
  ])('%s: the h1 and its subtitles in the band, Cancelar and Siguiente under it', async (path, title, subtitulo, kind) => {
    start('portal-tributario', path)
    const titulo = await h1(title)
    const banda = bandaDe(titulo)!
    expect(banda).toHaveTextContent(subtitulo)
    if (kind) expect(await within(banda).findByText(kind)).toBeInTheDocument()
    expect(within(banda).queryByRole('button')).not.toBeInTheDocument()

    const fila = filaDe(titulo)
    const cancelar = within(fila).getByRole('button', { name: 'Cancelar' })
    const siguiente = within(fila).getByRole('button', { name: 'Siguiente' })
    // the focus goes from Cancelar to Siguiente, as before
    cancelar.focus()
    await userEvent.tab()
    expect(siguiente).toHaveFocus()
    // stacked: the band, the chevron steps (#54) and the folder tabs
    const pasos = document.querySelector('[data-ui="pasos-galon"]')!
    const pestanas = document.querySelector('[data-ui="ficha-tabs"]')!
    expect(banda.compareDocumentPosition(pasos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(pasos.compareDocumentPosition(pestanas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['/contribuyentes/nuevo', 'Nuevo contribuyente'],
    ['/contribuyentes/c1/declaraciones/nueva', 'Nueva declaración jurada predial']
  ])('%s keeps its header of always with light', async (path, title) => {
    start('light', path)
    const titulo = await h1(title)
    expect(document.querySelector('[data-ui="banda-titulo"]')).toBeNull()
    expect(titulo).toHaveClass('text-xl', 'font-semibold', 'text-ink', 'uppercase')
    expect(titulo.nextElementSibling).toHaveClass('text-xs', 'font-semibold', 'tracking-wide', 'text-brand', 'uppercase', 'italic')
    const cabecera = titulo.parentElement!.parentElement!
    expect(cabecera).toHaveClass('flex', 'flex-wrap', 'items-end', 'justify-between', 'gap-4')
    expect(Array.from(cabecera.lastElementChild!.children).map((b) => b.textContent)).toEqual(['Cancelar', 'Siguiente'])
  })
})
