import { cn } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useVarianteTema } from '../../themes'

export interface FichaTab {
  id: string
  label: string
  icon?: LucideIcon
  // the srtm's greyed tabs: reachable only once the record exists
  disabled?: boolean
  render: () => ReactNode
}

// the ficha's tabs, controlled (the active one lives in the url, so a link can open a given tab).
// a panel mounts the first time it is opened and then stays, hidden: its list or its half-typed form survive.
// portal-tributario's folder tabs are text only: room for the ten of a contribuyente
export function FichaTabs({ tabs, label, active, onChange }: { tabs: FichaTab[]; label: string; active: string; onChange: (id: string) => void }) {
  const iconos = useVarianteTema() !== 'portal'
  const current = tabs.find((t) => t.id === active && !t.disabled) ?? tabs[0]
  const [opened, setOpened] = useState<string[]>([current.id])
  // recorded while rendering, not in an effect: the tab just picked mounts in this same render
  if (!opened.includes(current.id)) setOpened([...opened, current.id])

  // the wai-aria tabs pattern, activated by hand: the arrows walk the enabled tabs round, home and end jump to the
  // ends, enter or space opens the focused one. opening on focus would mount every panel on the way (and, in the
  // inscription, count each tab passed over as visited)
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
    <div data-slot="tabs">
      <div role="tablist" data-slot="tabs-list" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-border px-4">
        {tabs.map((tab) => {
          const selected = tab.id === current.id
          const Icon = iconos ? tab.icon : undefined
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
      {tabs
        .filter((tab) => opened.includes(tab.id))
        .map((tab) => (
          <div key={tab.id} role="tabpanel" data-slot="tabs-content" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== current.id}>
            {tab.render()}
          </div>
        ))}
    </div>
  )
}
