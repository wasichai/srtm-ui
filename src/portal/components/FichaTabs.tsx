import { cn } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useVarianteTema } from '../../themes'

export interface FichaTab {
  id: string
  label: string
  icon?: LucideIcon
  // the portal's vertical tabs only: tabs in a row with the same grupo make one tablist, headed and named by it
  grupo?: string
  // the srtm's greyed tabs: reachable only once the record exists
  disabled?: boolean
  render: () => ReactNode
}

interface FichaTabsProps {
  tabs: FichaTab[]
  label: string
  active: string
  onChange: (id: string) => void
  // the portal's vertical tabs only: what goes under them, in the left column (the year's figures)
  aside?: ReactNode
}

// the ficha's tabs, controlled (the active one lives in the url, so a link can open a given tab).
// a panel mounts the first time it is opened and then stays, hidden: its list or its half-typed form survive.
// light and dark draw them across the top. the portal-tributario variant draws the ficha in two columns: the tabs
// down the left (ColumnaPestanas), the open panel on the right, side by side while both fit (240px and 480px),
// stacked otherwise. the panels keep their place in either, so a theme switch keeps them, and what is typed in them
export function FichaTabs({ tabs, label, active, onChange, aside }: FichaTabsProps) {
  const vertical = useVarianteTema() === 'portal'
  const current = tabs.find((t) => t.id === active && !t.disabled) ?? tabs[0]
  const [opened, setOpened] = useState<string[]>([current.id])
  // recorded while rendering, not in an effect: the tab just picked mounts in this same render
  if (!opened.includes(current.id)) setOpened([...opened, current.id])

  // the horizontal strip's keys (the portal's vertical column has its own, in ColumnaPestanas): the wai-aria tabs
  // pattern, activated by hand. the arrows walk the enabled tabs round, home and end jump to the ends, enter or space
  // opens the focused one. opening on focus would mount every panel on the way (and, in the inscription, count each
  // tab passed over as visited)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const focus = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length].focus()
    }
    if (event.key === 'ArrowRight') focus(at + 1)
    else if (event.key === 'ArrowLeft') focus(at - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(-1)
  }

  return (
    <div data-slot="tabs" data-orientation={vertical ? 'vertical' : undefined} className={vertical ? 'flex flex-wrap items-start gap-y-4' : undefined}>
      {vertical ? (
        <ColumnaPestanas tabs={tabs} label={label} current={current} onChange={onChange} aside={aside} />
      ) : (
        <div role="tablist" data-slot="tabs-list" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-border px-4">
          {tabs.map((tab) => {
            const selected = tab.id === current.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-slot="tabs-trigger"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                aria-disabled={tab.disabled || undefined}
                disabled={tab.disabled}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  selected ? 'border-brand text-brand-strong' : 'border-transparent text-ink-muted hover:text-ink',
                  tab.disabled && 'cursor-not-allowed opacity-40 hover:text-ink-muted'
                )}
              >
                {Icon && <Icon className="size-4" />}
                {tab.label}
              </button>
            )
          })}
        </div>
      )}
      {tabs
        .filter((tab) => opened.includes(tab.id))
        .map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            data-slot="tabs-content"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={tab.id !== current.id}
            // the right column: only the open one is laid out
            className={vertical ? 'min-w-0 flex-[999_1_480px]' : undefined}
          >
            {tab.render()}
          </div>
        ))}
    </div>
  )
}

// the left column of the portal's ficha: the folder tabs, one under another, then the aside. tabs in a row with the
// same grupo make one tablist named by it, under it as a heading (hidden from screen readers: the name says it); the
// ungrouped ones, one named by the ficha. the arrows, home and end walk every tab of the ficha, across the groups,
// opening it as a click does: the open tab stays the only one in the tab order. the folders are the theme's tabs.css,
// hooked on data-orientation
function ColumnaPestanas({ tabs, label, current, onChange, aside }: Omit<FichaTabsProps, 'active'> & { current: FichaTab }) {
  const grupos = tabs.reduce<{ grupo?: string; tabs: FichaTab[] }[]>((acc, tab) => {
    const ultimo = acc.at(-1)
    if (ultimo && ultimo.grupo === tab.grupo) ultimo.tabs.push(tab)
    else acc.push({ grupo: tab.grupo, tabs: [tab] })
    return acc
  }, [])

  const mover = (event: KeyboardEvent, desde: string) => {
    const abiertas = tabs.filter((tab) => !tab.disabled)
    const at = abiertas.findIndex((tab) => tab.id === desde)
    const destino =
      event.key === 'ArrowDown' ? at + 1 : event.key === 'ArrowUp' ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? abiertas.length - 1 : null
    if (destino === null) return
    event.preventDefault()
    const tab = abiertas[(destino + abiertas.length) % abiertas.length]
    onChange(tab.id)
    document.getElementById(`tab-${tab.id}`)?.focus()
  }

  return (
    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-5">
      {grupos.map(({ grupo, tabs }, i) => (
        <div key={i}>
          {grupo && (
            <p aria-hidden className="pb-1.5 pl-0.5 text-xs font-bold tracking-wide text-ink-muted uppercase">
              {grupo}
            </p>
          )}
          <div role="tablist" data-slot="tabs-list" aria-orientation="vertical" aria-label={grupo ?? label} className="flex flex-col">
            {tabs.map((tab) => {
              const selected = tab.id === current.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-slot="tabs-trigger"
                  id={`tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  aria-disabled={tab.disabled || undefined}
                  disabled={tab.disabled}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onChange(tab.id)}
                  onKeyDown={(event) => mover(event, tab.id)}
                  className={cn('w-full', tab.disabled && 'cursor-not-allowed opacity-40')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {aside}
    </div>
  )
}
