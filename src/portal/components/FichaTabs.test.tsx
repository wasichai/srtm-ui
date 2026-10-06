import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@wasichai/testing'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SRTM_THEMES } from '../../themes'
import { FichaTabs, type FichaTab } from './FichaTabs'

// the hooks a theme styles the tabs by (the library's sheet for portal-tributario), with the aria and the lazy panels
// as before. portal-tributario draws them without icons

const TABS: FichaTab[] = [
  { id: 'datos', label: 'Datos', icon: FileText, render: () => <p>los datos</p> },
  { id: 'domicilios', label: 'Domicilios', render: () => <p>los domicilios</p> },
  { id: 'sustento', label: 'Sustento', disabled: true, render: () => <p>el sustento</p> }
]

function Ficha() {
  const [active, setActive] = useState('datos')
  return <FichaTabs tabs={TABS} label="Ficha" active={active} onChange={setActive} />
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

// under a theme picked in this browser (signed out, so no server preference)
function renderIn(theme = 'light') {
  localStorage.setItem('srtm.theme', theme)
  return renderWithProviders(<Ficha />, { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null })
}

describe('FichaTabs: the theme hooks', () => {
  it.each(['light', 'portal-tributario'])('marks the strip, each tab and each panel, keeping the tabs aria, with %s', (theme) => {
    renderIn(theme)
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

  it.each(['light', 'dark'])('keeps a disabled tab disabled and its icons with %s', (theme) => {
    renderIn(theme)
    expect(screen.getByRole('tab', { name: 'Sustento' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Datos' }).querySelector('svg')).not.toBeNull()
  })

  // the prototype's folder tabs are text only, all of them at the theme's 16px (the library's sheet)
  it('draws the tabs without icons with portal-tributario', () => {
    renderIn('portal-tributario')
    expect(screen.getByRole('tab', { name: 'Sustento' })).toBeDisabled()
    for (const tab of screen.getAllByRole('tab')) expect(tab.querySelector('svg')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveTextContent(/^Datos$/)
  })

  it('mounts a panel once opened and keeps it, hidden', async () => {
    renderIn()
    expect(screen.queryByText('los domicilios')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Domicilios' }))
    expect(screen.getByText('los domicilios')).toBeVisible()
    expect(screen.getByText('los datos')).not.toBeVisible()
  })
})
