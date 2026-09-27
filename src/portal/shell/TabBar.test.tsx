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

describe('TabBar: the theme hooks', () => {
  it('marks the strip and each tab, the open one by aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/contribuyentes/c1']}>
        <WorkspaceTabsProvider>
          <TabBar />
        </WorkspaceTabsProvider>
      </MemoryRouter>
    )
    const nav = screen.getByRole('navigation', { name: 'Fichas abiertas' })
    expect(nav).toHaveAttribute('data-ui', 'workspace-tabs')
    const ficha = screen.getByRole('link', { name: 'QUISPE MAMANI JUAN' })
    expect(ficha).toHaveAttribute('aria-current', 'page')
    expect(ficha.closest('li')).toHaveAttribute('data-ui', 'workspace-tab')
    expect(screen.getByRole('link', { name: 'Inicio' }).closest('li')).toHaveAttribute('data-ui', 'workspace-tab')
    expect(screen.getByRole('button', { name: 'Cerrar QUISPE MAMANI JUAN' })).toBeInTheDocument()
  })
})
