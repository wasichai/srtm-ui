import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TABS_KEY, TABS_USER_KEY } from '../auth/session'
import { TabBar } from './TabBar'
import { WorkspaceTabsProvider } from './WorkspaceTabs'

const QUISPE = { path: '/contribuyentes/c1', label: 'QUISPE MAMANI JUAN', kind: 'contribuyente' }

function montar(usuario?: string) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <WorkspaceTabsProvider usuario={usuario}>
        <TabBar />
      </WorkspaceTabsProvider>
    </MemoryRouter>
  )
  return within(screen.getByRole('navigation', { name: 'Fichas abiertas' }))
}

const guardadas = () => JSON.parse(sessionStorage.getItem(TABS_KEY) ?? 'null') as unknown

beforeEach(() => sessionStorage.clear())

describe('WorkspaceTabsProvider: whose tabs', () => {
  it("brings back the clerk's own tabs after a reload", () => {
    sessionStorage.setItem(TABS_KEY, JSON.stringify([QUISPE]))
    sessionStorage.setItem(TABS_USER_KEY, 'u1')
    expect(montar('u1').getByRole('link', { name: 'QUISPE MAMANI JUAN' })).toBeInTheDocument()
  })

  it("never shows another clerk's tabs (a session that ended without signing out here), and forgets them", () => {
    sessionStorage.setItem(TABS_KEY, JSON.stringify([QUISPE]))
    sessionStorage.setItem(TABS_USER_KEY, 'u2')
    expect(montar('u1').queryByRole('link', { name: 'QUISPE MAMANI JUAN' })).toBeNull()
    expect(guardadas()).toEqual([])
    expect(sessionStorage.getItem(TABS_USER_KEY)).toBe('u1')
  })

  it('keeps tabs with no owner out too, once a clerk is known', () => {
    sessionStorage.setItem(TABS_KEY, JSON.stringify([QUISPE]))
    expect(montar('u1').queryByRole('link', { name: 'QUISPE MAMANI JUAN' })).toBeNull()
  })
})

describe('WorkspaceTabsProvider: what is stored', () => {
  it('starts with no tabs over something that is not a list of them', () => {
    sessionStorage.setItem(TABS_KEY, '{"path":"/contribuyentes/c1"}')
    expect(
      montar()
        .getAllByRole('link')
        .map((l) => l.textContent)
    ).toEqual(['Inicio'])
  })

  it('leaves out the entries that are not tabs, and keeps the rest', () => {
    sessionStorage.setItem(TABS_KEY, JSON.stringify([null, 'x', { path: '/predios/p1' }, QUISPE]))
    expect(
      montar()
        .getAllByRole('link')
        .map((l) => l.textContent)
    ).toEqual(['Inicio', 'QUISPE MAMANI JUAN'])
  })
})
