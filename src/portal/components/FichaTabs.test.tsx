import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { FichaTabs, type FichaTab } from './FichaTabs'

// the hooks a theme styles the tabs by (portal-tributario's tabs.css), with the aria and the lazy panels as before

const TABS: FichaTab[] = [
  { id: 'datos', label: 'Datos', icon: FileText, render: () => <p>los datos</p> },
  { id: 'domicilios', label: 'Domicilios', render: () => <p>los domicilios</p> },
  { id: 'sustento', label: 'Sustento', disabled: true, render: () => <p>el sustento</p> }
]

function Ficha() {
  const [active, setActive] = useState('datos')
  return <FichaTabs tabs={TABS} label="Ficha" active={active} onChange={setActive} />
}

describe('FichaTabs: the theme hooks', () => {
  it('marks the strip, each tab and each panel, keeping the tabs aria', () => {
    render(<Ficha />)
    const tablist = screen.getByRole('tablist', { name: 'Ficha' })
    expect(tablist).toHaveAttribute('data-slot', 'tabs-list')
    expect(tablist.parentElement).toHaveAttribute('data-slot', 'tabs')
    const datos = screen.getByRole('tab', { name: 'Datos' })
    expect(datos).toHaveAttribute('data-slot', 'tabs-trigger')
    expect(datos).toHaveAttribute('aria-selected', 'true')
    expect(datos).toHaveAttribute('aria-controls', 'panel-datos')
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('data-slot', 'tabs-content')
  })

  it('keeps a disabled tab disabled and its icons', () => {
    render(<Ficha />)
    expect(screen.getByRole('tab', { name: 'Sustento' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Datos' }).querySelector('svg')).not.toBeNull()
  })

  it('mounts a panel once opened and keeps it, hidden', async () => {
    render(<Ficha />)
    expect(screen.queryByText('los domicilios')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Domicilios' }))
    expect(screen.getByText('los domicilios')).toBeVisible()
    expect(screen.getByText('los datos')).not.toBeVisible()
  })
})

describe('FichaTabs: the keyboard', () => {
  const CON_PREDIOS: FichaTab[] = [...TABS, { id: 'predios', label: 'Predios', render: () => <p>los predios</p> }]

  function Larga() {
    const [active, setActive] = useState('datos')
    return <FichaTabs tabs={CON_PREDIOS} label="Ficha" active={active} onChange={setActive} />
  }

  it('reaches only the open tab with tab, as one stop', async () => {
    render(<Larga />)
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveFocus()
    // the next tab goes on past the strip, not to Domicilios
    await userEvent.tab()
    expect(screen.getByRole('tablist')).not.toContainElement(document.activeElement as HTMLElement | null)
  })

  it('walks the enabled tabs with the arrows, round, skipping a disabled one, without opening them', async () => {
    render(<Larga />)
    screen.getByRole('tab', { name: 'Datos' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveFocus()
    // Sustento is disabled: the arrow goes past it
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Predios' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Predios' })).toHaveFocus()
    // moving the focus opens nothing: the panels mount only when picked
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('los predios')).toBeNull()
  })

  it('jumps to the ends with home and end, and opens the focused tab with enter', async () => {
    render(<Larga />)
    screen.getByRole('tab', { name: 'Datos' }).focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Predios' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveFocus()
    await userEvent.keyboard('{End}{Enter}')
    expect(screen.getByRole('tab', { name: 'Predios' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('los predios')).toBeVisible()
  })
})
