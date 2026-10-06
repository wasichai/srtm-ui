import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from '@wasichai/core'
import { renderWithProviders } from '@wasichai/testing'
import { FileText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SRTM_THEMES } from '../../themes'
import { FichaTabs, type FichaTab } from './FichaTabs'

// the hooks a theme styles the tabs by (the library's sheet the horizontal ones, portal-tributario's tabs.css the
// vertical ones), with the aria and the lazy panels as before. light and dark draw them across the top; the portal's
// variant down the left of the ficha, grouped, with the panel on the right

const TABS: FichaTab[] = [
  { id: 'datos', label: 'Datos', icon: FileText, render: () => <p>los datos</p> },
  { id: 'domicilios', label: 'Domicilios', render: () => <p>los domicilios</p> },
  { id: 'sustento', label: 'Sustento', disabled: true, render: () => <p>el sustento</p> }
]

// two groups, the second after a disabled tab: the arrows go across them
const AGRUPADAS: FichaTab[] = [
  { id: 'datos', label: 'Datos', grupo: 'Registro tributario', icon: FileText, render: () => <p>los datos</p> },
  { id: 'domicilios', label: 'Domicilios', grupo: 'Registro tributario', render: () => <p>los domicilios</p> },
  { id: 'sustento', label: 'Sustento', grupo: 'Registro tributario', disabled: true, render: () => <p>el sustento</p> },
  { id: 'predios', label: 'Predios', grupo: 'Rentas', render: () => <p>los predios</p> },
  { id: 'arbitrios', label: 'Arbitrios', grupo: 'Rentas', render: () => <p>los arbitrios</p> }
]

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

function Ficha({ tabs = TABS, aside }: { tabs?: FichaTab[]; aside?: ReactNode }) {
  const [active, setActive] = useState('datos')
  return <FichaTabs tabs={tabs} label="Ficha" active={active} onChange={setActive} aside={aside} />
}

// under a theme picked in this browser (signed out, so no server preference)
function renderIn(theme: string, ui = <Ficha />) {
  localStorage.setItem('srtm.theme', theme)
  return renderWithProviders(ui, { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null })
}

describe.each(['light', 'portal-tributario'])('FichaTabs with %s: the theme hooks', (theme) => {
  it('marks the strip, each tab and each panel, keeping the tabs aria', () => {
    renderIn(theme)
    const tablist = screen.getByRole('tablist', { name: 'Ficha' })
    expect(tablist).toHaveAttribute('data-slot', 'tabs-list')
    expect(tablist.closest('[data-slot="tabs"]')).not.toBeNull()
    const datos = screen.getByRole('tab', { name: 'Datos' })
    expect(datos).toHaveAttribute('data-slot', 'tabs-trigger')
    expect(datos).toHaveAttribute('aria-selected', 'true')
    expect(datos).toHaveAttribute('aria-controls', 'panel-datos')
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('data-slot', 'tabs-content')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-datos')
  })

  it('keeps a disabled tab disabled, and the open one alone in the tab order', () => {
    renderIn(theme)
    expect(screen.getByRole('tab', { name: 'Sustento' })).toBeDisabled()
    expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
  })

  it('mounts a panel once opened and keeps it, hidden', async () => {
    renderIn(theme)
    expect(screen.queryByText('los domicilios')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Domicilios' }))
    expect(screen.getByText('los domicilios')).toBeVisible()
    expect(screen.getByText('los datos')).not.toBeVisible()
    expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([-1, 0, -1])
  })
})

describe('FichaTabs with light', () => {
  // the markup of always: one strip across the top, with the icons, and no aside
  it('draws the tabs across the top, with their icons, in one strip', () => {
    renderIn('light', <Ficha tabs={AGRUPADAS} aside={<p>el resumen</p>} />)
    const raiz = document.querySelector('[data-slot="tabs"]')!
    expect(raiz).not.toHaveAttribute('data-orientation')
    const tablist = screen.getByRole('tablist', { name: 'Ficha' })
    expect(screen.getAllByRole('tablist')).toEqual([tablist])
    expect(tablist).not.toHaveAttribute('aria-orientation')
    expect(tablist).toHaveClass('flex', 'gap-1', 'overflow-x-auto', 'border-b', 'border-border', 'px-4')
    expect(raiz.firstElementChild).toBe(tablist)
    expect(screen.getByRole('tab', { name: 'Datos' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveClass('border-b-2', 'border-brand', 'text-brand-strong')
    expect(screen.queryByText('Registro tributario')).not.toBeInTheDocument()
    expect(screen.queryByText('el resumen')).not.toBeInTheDocument()
  })
})

describe('FichaTabs with portal-tributario', () => {
  // the left column, then the panels: the open one is the right column
  const columnas = () => {
    const raiz = document.querySelector<HTMLElement>('[data-slot="tabs"]')!
    return { raiz, izquierda: raiz.children[0] as HTMLElement, derecha: screen.getByRole('tabpanel') }
  }

  it('draws the tabs down the left column and the open panel as the right one', () => {
    renderIn('portal-tributario')
    const { raiz, izquierda, derecha } = columnas()
    expect(raiz).toHaveAttribute('data-orientation', 'vertical')
    expect(raiz).toHaveClass('flex', 'flex-wrap', 'items-start')
    expect(raiz.children).toHaveLength(2)
    expect(izquierda).toHaveClass('flex-[1_1_240px]', 'min-w-0', 'flex-col')
    expect(derecha.parentElement).toBe(raiz)
    expect(derecha).toHaveClass('flex-[999_1_480px]', 'min-w-0')
    expect(izquierda).toContainElement(screen.getByRole('tablist', { name: 'Ficha' }))
    // without a group, one tablist with the ficha's name and no heading
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical')
    expect(screen.getByRole('tablist').previousElementSibling).toBeNull()
    // the folder tabs carry no icon
    expect(screen.getByRole('tab', { name: 'Datos' }).querySelector('svg')).toBeNull()
  })

  it('makes one tablist of each group, named and headed by it', () => {
    renderIn('portal-tributario', <Ficha tabs={AGRUPADAS} />)
    const listas = screen.getAllByRole('tablist')
    expect(
      listas.map((lista) => [
        lista.getAttribute('aria-orientation'),
        within(lista)
          .getAllByRole('tab')
          .map((t) => t.textContent)
      ])
    ).toEqual([
      ['vertical', ['Datos', 'Domicilios', 'Sustento']],
      ['vertical', ['Predios', 'Arbitrios']]
    ])
    expect(listas[0]).toHaveAttribute('aria-label', 'Registro tributario')
    expect(listas[1]).toHaveAttribute('aria-label', 'Rentas')
    // the heading shows the name: read once, as the tablist's
    const encabezado = screen.getByText('Rentas')
    expect(encabezado).toHaveClass('text-xs', 'font-bold', 'uppercase', 'text-ink-muted')
    expect(encabezado).toHaveAttribute('aria-hidden', 'true')
    expect(encabezado.nextElementSibling).toBe(listas[1])
  })

  it('walks every tab of the ficha with the arrows, home and end, across its groups and past a disabled one', async () => {
    renderIn('portal-tributario', <Ficha tabs={AGRUPADAS} />)
    const tab = (name: string) => screen.getByRole('tab', { name })
    const abierta = (name: string) => {
      expect(tab(name)).toHaveFocus()
      expect(tab(name)).toHaveAttribute('aria-selected', 'true')
      expect(screen.getAllByRole('tab').filter((t) => t.tabIndex === 0)).toEqual([tab(name)])
    }
    await userEvent.tab()
    abierta('Datos')
    await userEvent.keyboard('{ArrowDown}')
    abierta('Domicilios')
    await userEvent.keyboard('{ArrowDown}')
    abierta('Predios')
    expect(screen.getByText('los predios')).toBeVisible()
    await userEvent.keyboard('{ArrowUp}')
    abierta('Domicilios')
    await userEvent.keyboard('{End}')
    abierta('Arbitrios')
    await userEvent.keyboard('{ArrowDown}')
    abierta('Datos')
    await userEvent.keyboard('{ArrowUp}')
    abierta('Arbitrios')
    await userEvent.keyboard('{Home}')
    abierta('Datos')
    // the sideways arrows are not the vertical tabs'
    await userEvent.keyboard('{ArrowRight}')
    abierta('Datos')
  })

  it('puts the aside under the tabs, in the left column', () => {
    renderIn('portal-tributario', <Ficha tabs={AGRUPADAS} aside={<p>el resumen</p>} />)
    const { izquierda } = columnas()
    expect(izquierda.lastElementChild).toHaveTextContent('el resumen')
  })

  // the panels keep their place: a theme switch does not lose what is typed in a ficha
  it('keeps what is typed in a panel across a theme switch', async () => {
    const conCampo: FichaTab[] = [{ id: 'datos', label: 'Datos', render: () => <input aria-label="Nombres" /> }, ...TABS.slice(1)]
    renderIn(
      'light',
      <>
        <CambiarTema />
        <Ficha tabs={conCampo} />
      </>
    )
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombres' }), 'JUAN')
    await userEvent.click(screen.getByRole('button', { name: 'Portal tributario' }))
    expect(await screen.findByRole('tablist', { name: 'Ficha' })).toHaveAttribute('aria-orientation', 'vertical')
    expect(screen.getByRole('textbox', { name: 'Nombres' })).toHaveValue('JUAN')
  })
})

function CambiarTema() {
  const { setPreference } = useTheme()
  return (
    <button type="button" onClick={() => void setPreference('portal-tributario')}>
      Portal tributario
    </button>
  )
}
