import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { MenuSecciones } from './MenuPortal'
import type { NodoNav } from './navTree'

// the bar draws any tree: subgroups (none in NAV_TREE today) as indented headings in their group's panel, and leaves
// at the root after the groups, at the far right

const ARBOL: NodoNav[] = [
  {
    label: 'Grupo con nombre largo',
    corto: 'Grupo',
    children: [
      { label: 'Hoja', to: '/hoja' },
      { label: 'Subgrupo', children: [{ label: 'Hoja del subgrupo', to: '/sub/hoja' }] }
    ]
  },
  { label: 'Otra app', to: '/otra', external: true, icon: Settings },
  { label: 'Página propia', to: '/propia' },
  { label: 'Otro grupo', children: [{ label: 'Hoja suelta', to: '/suelta' }] }
]

const enRuta = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MenuSecciones nodos={ARBOL} />
    </MemoryRouter>
  )

const panelDe = (boton: HTMLElement) => document.getElementById(boton.getAttribute('aria-controls')!)!

describe('MenuSecciones', () => {
  it('puts the groups after home and the leaves of the root at the far right', () => {
    enRuta('/')
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    const items = Array.from(nav.querySelector('ul')!.children).map((li) => li.firstElementChild!.textContent)
    expect(items).toEqual(['Inicio', 'Grupo', 'Otro grupo', 'Otra app', 'Página propia'])
    const externa = within(nav).getByRole('link', { name: 'Otra app' })
    expect(externa).toHaveAttribute('href', '/otra')
    expect(externa.parentElement).toHaveClass('ml-auto')
    expect(within(nav).getByRole('link', { name: 'Página propia' }).parentElement).not.toHaveClass('ml-auto')
    // only a group with a short label gets its full name as the button's
    expect(within(nav).getByRole('button', { name: 'Grupo con nombre largo' })).toHaveTextContent(/^Grupo$/)
    expect(within(nav).getByRole('button', { name: 'Otro grupo' })).not.toHaveAttribute('aria-label')
  })

  it('heads a subgroup in its panel, its leaves indented further', async () => {
    enRuta('/sub/hoja')
    const boton = screen.getByRole('button', { name: 'Grupo con nombre largo' })
    // the current leaf is in a subgroup: its group is marked all the same
    expect(boton).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Otro grupo' })).not.toHaveAttribute('aria-current')

    await userEvent.click(boton)
    const panel = panelDe(boton)
    expect(within(panel).getByText('Grupo con nombre largo')).toHaveClass('text-[17px]')
    expect(within(panel).getByText('Subgrupo')).toHaveClass('text-base', 'font-bold', 'text-ink')
    expect(within(panel).getByRole('link', { name: 'Hoja' })).toHaveClass('pl-5')
    const hoja = within(panel).getByRole('link', { name: 'Hoja del subgrupo' })
    expect(hoja).toHaveClass('pl-[34px]')
    expect(hoja).toHaveAttribute('aria-current', 'page')
    // the subgroup's list is under its heading
    expect(within(panel).getByText('Subgrupo').parentElement).toContainElement(hoja)
  })

  it('marks a leaf of the root on its page', () => {
    enRuta('/propia')
    const hoja = screen.getByRole('link', { name: 'Página propia' })
    expect(hoja).toHaveAttribute('aria-current', 'page')
    expect(hoja).toHaveClass('border-b-link')
    expect(screen.queryAllByRole('button', { current: true })).toEqual([])
  })
})
