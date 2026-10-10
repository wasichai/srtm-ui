import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// the ficha in two columns of the portal-tributario theme: its tabs down the left, grouped, with the year's figures
// under them, and the panel on the right. light keeps the tabs across the top and the figures over them

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
  nombre_completo: 'QUISPE MAMANI JUAN'
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
    { path: /^\/srtm\/(contribuyentes|predios)\/[cp]1\//, body: [] },
    { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
    { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 2, totales } },
    { path: '/srtm/declaraciones/d1', body: { declaracion, predio, contribuyente, actualizado: '2026-09-25T14:03:00Z' } },
    { path: /^\/srtm\/declaraciones\/d1\//, body: [] }
  ]
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const pestanas = (lista: HTMLElement) =>
  within(lista)
    .getAllByRole('tab')
    .map((tab) => tab.textContent)
const raiz = () => document.querySelector<HTMLElement>('[data-slot="tabs"]')!
// the figures of a card: its label, then its value
const cifras = (tarjeta: HTMLElement) =>
  within(tarjeta)
    .getAllByRole('listitem')
    .map((cifra) => cifra.textContent)

describe('ficha in two columns', () => {
  it("groups the contribuyente's tabs: the srtm's registro tributario, then rentas'", async () => {
    start('portal-tributario', '/contribuyentes/c1')
    await h1('QUISPE MAMANI JUAN')
    expect(raiz()).toHaveAttribute('data-orientation', 'vertical')
    expect(screen.getAllByRole('tablist')).toHaveLength(2)
    expect(pestanas(screen.getByRole('tablist', { name: 'Registro tributario' }))).toEqual([
      'Datos del contribuyente',
      'Domicilios',
      'Relacionados',
      'Medios de contacto',
      'Sustento'
    ])
    expect(pestanas(screen.getByRole('tablist', { name: 'Rentas' }))).toEqual(['Predios', 'Declaraciones', 'Arbitrios', 'Infracciones', 'Anuncios'])
  })

  it('goes from one group to the next with the arrows, the url following', async () => {
    start('portal-tributario', '/contribuyentes/c1?tab=sustento')
    await h1('QUISPE MAMANI JUAN')
    const sustento = screen.getByRole('tab', { name: 'Sustento' })
    expect(sustento).toHaveAttribute('aria-selected', 'true')
    sustento.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: 'Predios' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Predios' })).toHaveAttribute('aria-selected', 'true')
    expect(window.location.search).toBe('?tab=predios')
  })

  it("puts the year's figures in one card under the contribuyente's tabs, not over them", async () => {
    start('portal-tributario', '/contribuyentes/c1')
    await h1('QUISPE MAMANI JUAN')
    const resumen = screen.getByRole('heading', { level: 2, name: `Resumen ${year}` })
    const tarjeta = resumen.closest<HTMLElement>('[data-slot="card"]')!
    // the left column's last piece, after the tabs
    expect(raiz().firstElementChild!.lastElementChild).toBe(tarjeta)
    expect(cifras(tarjeta)).toEqual([
      'Predios1',
      expect.stringMatching(/^Autoavalúo.*10[.,]080[.,]45$/),
      expect.stringMatching(/^Valor afecto.*8[.,]000[.,]00$/)
    ])
    // stacked, each an icon in a 40px circle, its label small, bold and in capitals, its value 18px bold
    const cifra = within(tarjeta).getAllByRole('listitem')[0]
    expect(cifra.firstElementChild).toHaveClass('size-10', 'rounded-full')
    expect(within(tarjeta).getByText('Predios')).toHaveClass('text-xs', 'font-bold', 'uppercase')
    expect(within(tarjeta).getByText('1')).toHaveClass('text-lg', 'font-bold')
    expect(screen.queryByText(`Predios ${year}`)).not.toBeInTheDocument()
  })

  it("gives the predio's tabs one unnamed group, its figures in the card", async () => {
    start('portal-tributario', '/predios/p1')
    await h1(/01-01-0001/)
    const listas = screen.getAllByRole('tablist')
    expect(listas).toHaveLength(1)
    expect(listas[0]).toHaveAccessibleName('Secciones del predio')
    expect(listas[0].previousElementSibling).toBeNull()
    expect(pestanas(listas[0])).toEqual(['Datos de la ubicación', 'Titulares', 'Declaraciones', 'Arbitrios', 'Infracciones', 'Anuncios'])
    const tarjeta = screen.getByRole('heading', { level: 2, name: `Resumen ${year}` }).closest<HTMLElement>('[data-slot="card"]')!
    expect(cifras(tarjeta)[0]).toBe('Titulares2')
    expect(screen.queryByText(`Titulares ${year}`)).not.toBeInTheDocument()
  })

  it('draws the declaración in two columns, with no figures', async () => {
    start('portal-tributario', '/declaraciones/d1')
    await h1('Declaración jurada predial - 39147')
    expect(raiz()).toHaveAttribute('data-orientation', 'vertical')
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(screen.queryByRole('heading', { level: 2, name: /^Resumen/ })).not.toBeInTheDocument()
  })

  it('keeps the tabs across the top and the three figures over them with light', async () => {
    start('light', '/contribuyentes/c1')
    await h1('QUISPE MAMANI JUAN')
    expect(raiz()).not.toHaveAttribute('data-orientation')
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(screen.getByRole('tablist')).toHaveAccessibleName('Secciones del contribuyente')
    expect(screen.queryByRole('heading', { level: 2, name: /^Resumen/ })).not.toBeInTheDocument()
    const grilla = screen.getByText(`Predios ${year}`).closest('.grid')!
    expect(grilla).toHaveClass('gap-4', 'sm:grid-cols-3')
    expect(Array.from(grilla.children).map((tarjeta) => tarjeta.querySelector('p')?.textContent)).toEqual([
      `Predios ${year}`,
      `Autoavalúo ${year}`,
      `Valor afecto ${year}`
    ])
    // over the tabs
    expect(grilla.compareDocumentPosition(raiz()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
