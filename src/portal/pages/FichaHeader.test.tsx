import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@wasichai/testing'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SRTM_THEMES } from '../../themes'
import { FichaHeader } from './FichaHeader'

// the ficha's header (#55): a title band under portal-tributario, the header of always in light and dark

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

// under a theme picked in this browser (signed out, so no server preference), on a page
function renderIn(theme: string, ui: ReactElement, route = '/') {
  localStorage.setItem('srtm.theme', theme)
  return renderWithProviders(ui, { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null, route })
}

const ficha = (
  <FichaHeader
    kind="Contribuyente Nº 000012"
    title="QUISPE MAMANI JUAN"
    badges={<span>DNI 20529936</span>}
    aside={
      <button type="button" data-testid="aside">
        Eliminar
      </button>
    }
  />
)

// the markup FichaHeader drew before the band: light and dark keep it to the attribute
const CLASICO =
  '<div class="flex flex-wrap items-end justify-between gap-4">' +
  '<div class="min-w-0">' +
  '<p class="text-xs font-semibold tracking-wide text-ink-muted uppercase">Contribuyente Nº 000012</p>' +
  '<h1 class="mt-0.5 text-xl font-semibold break-words text-ink">QUISPE MAMANI JUAN</h1>' +
  '<div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted"><span>DNI 20529936</span></div>' +
  '</div>' +
  '<button type="button" data-testid="aside">Eliminar</button>' +
  '</div>'

describe('FichaHeader', () => {
  it.each(['light', 'dark'])('keeps its markup with %s', (theme) => {
    const { container } = renderIn(theme, ficha)
    expect(container.innerHTML).toBe(CLASICO)
  })

  // the trail is the shell's strip there, not the header's
  it('keeps its markup on a page with a trail with light', () => {
    const { container } = renderIn('light', ficha, '/contribuyentes/c1')
    expect(container.innerHTML).toBe(CLASICO)
  })

  it('keeps its markup without badges nor aside with light', () => {
    const { container } = renderIn('light', <FichaHeader kind="Catastro fiscal" title="Nuevo lote" />)
    expect(container.innerHTML).toBe(
      '<div class="flex flex-wrap items-end justify-between gap-4"><div class="min-w-0">' +
        '<p class="text-xs font-semibold tracking-wide text-ink-muted uppercase">Catastro fiscal</p>' +
        '<h1 class="mt-0.5 text-xl font-semibold break-words text-ink">Nuevo lote</h1></div></div>'
    )
  })

  it('draws the kind and the h1 in the title band with portal-tributario, the badges and the aside under it', () => {
    renderIn('portal-tributario', ficha)
    const h1 = screen.getByRole('heading', { level: 1, name: 'QUISPE MAMANI JUAN' })
    const banda = h1.closest('[data-ui="banda-titulo"]') as HTMLElement
    expect(banda).toHaveClass('bg-brand', 'text-on-brand')
    expect(banda).toHaveTextContent('Contribuyente Nº 000012')
    const fila = banda.nextElementSibling as HTMLElement
    expect(fila).toHaveAttribute('data-ui', 'cabecera-fila')
    expect(within(fila).getByText('DNI 20529936')).toBeVisible()
    expect(within(fila).getByRole('button', { name: 'Eliminar' })).toBeVisible()
  })

  it("shows the trail to the ficha in the band with portal-tributario, the srtm's group and the screen", () => {
    renderIn('portal-tributario', ficha, '/contribuyentes/c1')
    const banda = screen.getByRole('heading', { level: 1 }).closest('[data-ui="banda-titulo"]') as HTMLElement
    expect(within(banda).getByRole('navigation', { name: 'Ruta' })).toHaveTextContent(/^Registro tributario › Registro de contribuyente$/)
  })

  it('offers the help only when given one', () => {
    renderIn('portal-tributario', <FichaHeader kind="Predio" title="01-01-0001" ayuda={() => {}} />)
    expect(screen.getByRole('button', { name: 'Ayuda de este formulario' })).toBeInTheDocument()
  })
})
