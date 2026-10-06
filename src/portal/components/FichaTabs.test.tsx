import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@wasichai/testing'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SRTM_THEMES } from '../../themes'
import { FichaTabs, type FichaTab } from './FichaTabs'

// the hooks a theme styles the tabs by (portal-tributario's tabs.css), with the aria and the lazy panels as before.
// under the portal the tabs that do not fit go into "Más (n)", a menu (priority+)

const TABS: FichaTab[] = [
  { id: 'datos', label: 'Datos', icon: FileText, render: () => <p>los datos</p> },
  { id: 'domicilios', label: 'Domicilios', render: () => <p>los domicilios</p> },
  { id: 'sustento', label: 'Sustento', disabled: true, render: () => <p>el sustento</p> }
]

// a contribuyente's seven, the fifth greyed
const SIETE: FichaTab[] = ['Datos', 'Domicilios', 'Relacionados', 'Contacto', 'Sustento', 'Predios', 'Declaraciones'].map((label) => ({
  id: label.toLowerCase(),
  label,
  icon: FileText,
  disabled: label === 'Sustento',
  render: () => <p>panel de {label}</p>
}))

function Ficha({ tabs = TABS, inicial = tabs[0].id, onChange }: { tabs?: FichaTab[]; inicial?: string; onChange?: (id: string) => void }) {
  const [active, setActive] = useState(inicial)
  return (
    <FichaTabs
      tabs={tabs}
      label="Ficha"
      active={active}
      onChange={(id) => {
        onChange?.(id)
        setActive(id)
      }}
    />
  )
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// under a theme picked in this browser (signed out, so no server preference)
function renderIn(theme: string, ui = <Ficha />) {
  localStorage.setItem('srtm.theme', theme)
  return renderWithProviders(ui, { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null })
}

// jsdom lays nothing out: a strip of `tira.ancho` px, tabs of 100px and a "Más" of 80px, and a ResizeObserver the
// test fires
function medidas(ancho: number) {
  const tira = { ancho }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.dataset.ui === 'pestanas-tira' ? tira.ancho : this.getAttribute('role') === 'tab' ? 100 : this.dataset.ui === 'pestanas-mas' ? 80 : 0
    return { width, height: 40, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 40, toJSON: () => ({}) } as DOMRect
  })
  const observadores: (() => void)[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: () => void
      constructor(callback: () => void) {
        this.callback = callback
      }
      observe() {
        observadores.push(this.callback)
      }
      unobserve() {}
      disconnect() {}
    }
  )
  return {
    redimensionar(nuevo: number) {
      tira.ancho = nuevo
      act(() => observadores.forEach((callback) => callback()))
    }
  }
}

const tablist = () => screen.getByRole('tablist', { name: 'Ficha' })
const pestanas = () =>
  within(tablist())
    .getAllByRole('tab')
    .map((tab) => tab.textContent)
const mas = () => screen.getByRole('button', { name: /^Más \(\d\)$/ })
const menu = () => screen.getByRole('menu', { name: 'Más secciones' })
const opciones = () => within(menu()).getAllByRole('menuitem')

describe('FichaTabs: the theme hooks', () => {
  it('marks the strip, each tab and each panel, keeping the tabs aria', () => {
    renderIn('light')
    expect(tablist()).toHaveAttribute('data-slot', 'tabs-list')
    expect(tablist().parentElement).toHaveAttribute('data-slot', 'tabs')
    const datos = screen.getByRole('tab', { name: 'Datos' })
    expect(datos).toHaveAttribute('data-slot', 'tabs-trigger')
    expect(datos).toHaveAttribute('aria-selected', 'true')
    expect(datos).toHaveAttribute('aria-controls', 'panel-datos')
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('data-slot', 'tabs-content')
  })

  it('keeps a disabled tab disabled and its icons', () => {
    renderIn('light')
    expect(screen.getByRole('tab', { name: 'Sustento' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Datos' }).querySelector('svg')).not.toBeNull()
  })

  it('mounts a panel once opened and keeps it, hidden', async () => {
    renderIn('light')
    expect(screen.queryByText('los domicilios')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Domicilios' }))
    expect(screen.getByText('los domicilios')).toBeVisible()
    expect(screen.getByText('los datos')).not.toBeVisible()
  })
})

describe('FichaTabs: classic', () => {
  // no "Más": the strip scrolls sideways, as always
  it.each(['light', 'dark'])('keeps every tab with its icon in a strip that scrolls, with %s', (theme) => {
    medidas(300)
    renderIn(theme, <Ficha tabs={SIETE} />)
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Relacionados', 'Contacto', 'Sustento', 'Predios', 'Declaraciones'])
    expect(tablist()).toHaveClass('overflow-x-auto')
    for (const tab of within(tablist()).getAllByRole('tab')) expect(tab.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /^Más/ })).not.toBeInTheDocument()
  })
})

describe('FichaTabs: portal-tributario', () => {
  it('draws the tabs without icons, all of them where they fit', () => {
    renderIn('portal-tributario', <Ficha tabs={SIETE} />)
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Relacionados', 'Contacto', 'Sustento', 'Predios', 'Declaraciones'])
    for (const tab of within(tablist()).getAllByRole('tab')) expect(tab.querySelector('svg')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Más/ })).not.toBeInTheDocument()
    // the strip holds the tablist and, when it is needed, "Más"; the tabs' parts are still the theme's hooks
    expect(tablist().parentElement).toHaveAttribute('data-ui', 'pestanas-tira')
    expect(tablist().parentElement!.parentElement).toHaveAttribute('data-slot', 'tabs')
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('data-slot', 'tabs-trigger')
  })

  // 450px: four tabs of 100px and "Más" of 80px. what does not fit goes to the menu, in its order
  it('puts the tabs that do not fit into a last folder tab, "Más (n)", outside the tablist', () => {
    medidas(450)
    renderIn('portal-tributario', <Ficha tabs={SIETE} />)
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Relacionados'])
    const boton = mas()
    expect(boton).toHaveTextContent('Más (4)')
    expect(boton).toHaveAttribute('data-ui', 'pestanas-mas')
    expect(boton).toHaveAttribute('type', 'button')
    expect(boton).toHaveAttribute('aria-haspopup', 'menu')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(tablist()).not.toContainElement(boton)
    // the ones in the menu are not tabs of the strip any more
    expect(screen.queryByRole('tab', { name: 'Contacto' })).not.toBeInTheDocument()
  })

  it('opens the menu, walks it with the arrows and closes it with escape, focus back on "Más"', async () => {
    medidas(450)
    renderIn('portal-tributario', <Ficha tabs={SIETE} />)
    const boton = mas()
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(boton).toHaveAttribute('aria-controls', menu().id)
    expect(menu()).toHaveAttribute('data-ui', 'pestanas-menu')
    const items = opciones()
    expect(items.map((item) => item.textContent)).toEqual(['Contacto', 'Sustento', 'Predios', 'Declaraciones'])
    expect(items[0]).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(items[3]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(items[3]).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).toHaveFocus()

    // from the keyboard too, and a click anywhere else closes it
    await userEvent.keyboard('{ArrowDown}')
    expect(opciones()[0]).toHaveFocus()
    await userEvent.click(screen.getByText('panel de Datos'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // the chosen tab takes the last slot of the strip; the one it pushes out goes to the menu
  it('selects the tab chosen in the menu, shown in the last slot, its panel mounted and focus on it', async () => {
    medidas(450)
    const onChange = vi.fn()
    renderIn('portal-tributario', <Ficha tabs={SIETE} onChange={onChange} />)
    await userEvent.click(mas())
    await userEvent.click(within(menu()).getByRole('menuitem', { name: 'Predios' }))
    expect(onChange).toHaveBeenCalledWith('predios')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Predios'])
    const predios = screen.getByRole('tab', { name: 'Predios' })
    expect(predios).toHaveAttribute('aria-selected', 'true')
    expect(predios).toHaveFocus()
    expect(screen.getByText('panel de Predios')).toBeVisible()
    expect(screen.getByText('panel de Datos')).not.toBeVisible()
    await userEvent.click(mas())
    expect(opciones().map((item) => item.textContent)).toEqual(['Relacionados', 'Contacto', 'Sustento', 'Declaraciones'])
  })

  it('shows the selected tab even when it opens beyond the room', () => {
    medidas(450)
    renderIn('portal-tributario', <Ficha tabs={SIETE} inicial="declaraciones" />)
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Declaraciones'])
    expect(screen.getByRole('tab', { name: 'Declaraciones' })).toHaveAttribute('aria-selected', 'true')
    expect(mas()).toHaveTextContent('Más (4)')
  })

  it('keeps a greyed tab greyed in the menu: it does not select it', async () => {
    medidas(450)
    const onChange = vi.fn()
    renderIn('portal-tributario', <Ficha tabs={SIETE} onChange={onChange} />)
    await userEvent.click(mas())
    const sustento = within(menu()).getByRole('menuitem', { name: 'Sustento' })
    expect(sustento).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(sustento)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('gives the tabs back to the strip as it widens, and takes them as it narrows', () => {
    const pantalla = medidas(450)
    renderIn('portal-tributario', <Ficha tabs={SIETE} />)
    expect(pestanas()).toHaveLength(3)

    pantalla.redimensionar(700)
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Relacionados', 'Contacto', 'Sustento', 'Predios', 'Declaraciones'])
    expect(screen.queryByRole('button', { name: /^Más/ })).not.toBeInTheDocument()

    pantalla.redimensionar(600)
    expect(pestanas()).toEqual(['Datos', 'Domicilios', 'Relacionados', 'Contacto', 'Sustento'])
    expect(mas()).toHaveTextContent('Más (2)')
  })
})
