import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TABS_KEY } from '../auth/session'
import { TabBar } from './TabBar'
import { WorkspaceTabsProvider } from './WorkspaceTabs'

// the hooks a theme styles the workspace tabs by (portal-tributario's tabs.css)

beforeEach(() => {
  sessionStorage.setItem(TABS_KEY, JSON.stringify([{ path: '/contribuyentes/c1', label: 'QUISPE MAMANI JUAN', kind: 'contribuyente' }]))
})

function renderBar(bar = <TabBar />) {
  return render(
    <MemoryRouter initialEntries={['/contribuyentes/c1']}>
      <WorkspaceTabsProvider>{bar}</WorkspaceTabsProvider>
    </MemoryRouter>
  )
}

describe('TabBar: the theme hooks', () => {
  it('marks the strip and each tab, the open one by aria-current', () => {
    renderBar()
    const nav = screen.getByRole('navigation', { name: 'Fichas abiertas' })
    expect(nav).toHaveAttribute('data-ui', 'workspace-tabs')
    const ficha = screen.getByRole('link', { name: 'QUISPE MAMANI JUAN' })
    expect(ficha).toHaveAttribute('aria-current', 'page')
    expect(ficha.closest('li')).toHaveAttribute('data-ui', 'workspace-tab')
    expect(screen.getByRole('link', { name: 'Inicio' }).closest('li')).toHaveAttribute('data-ui', 'workspace-tab')
    expect(screen.getByRole('button', { name: 'Cerrar QUISPE MAMANI JUAN' })).toBeInTheDocument()
  })

  // over the content (the classic shell): a strip of its own
  it('draws a strip over the content by default', () => {
    const { container } = renderBar()
    const nav = screen.getByRole('navigation', { name: 'Fichas abiertas' })
    expect(nav).not.toHaveAttribute('data-ubicacion')
    expect(nav).toHaveClass('border-b', 'border-border', 'bg-surface', 'px-4')
    expect(container.querySelector('ul')).toHaveClass('flex', 'gap-1', 'overflow-x-auto', 'pt-2')
  })

  // the portal's brand bar: its second row, from the content's edge on a wide screen (the rail's 104px and the
  // content's 24px, less the bar's own 16px). tabs.css paints it
  it('marks itself as the header row when it goes in the brand bar', () => {
    const { container } = renderBar(<TabBar ubicacion="cabecera" />)
    const nav = screen.getByRole('navigation', { name: 'Fichas abiertas' })
    expect(nav).toHaveAttribute('data-ui', 'workspace-tabs')
    expect(nav).toHaveAttribute('data-ubicacion', 'cabecera')
    expect(nav).toHaveClass('basis-full', 'sm:pl-28')
    expect(nav).not.toHaveClass('bg-surface')
    expect(nav).not.toHaveClass('border-b')
    expect(container.querySelector('ul')).not.toHaveClass('pt-2')
    expect(screen.getByRole('link', { name: 'QUISPE MAMANI JUAN' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Cerrar QUISPE MAMANI JUAN' })).toBeInTheDocument()
  })
})
