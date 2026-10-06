import { cn } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
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
  useEffect(() => setOpened((ids) => (ids.includes(current.id) ? ids : [...ids, current.id])), [current.id])
  // the tab just picked shows in this render, before the effect records it
  const mounted = opened.includes(current.id) ? opened : [...opened, current.id]

  return (
    <div data-slot="tabs">
      <div role="tablist" data-slot="tabs-list" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border px-4">
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
        .filter((tab) => mounted.includes(tab.id))
        .map((tab) => (
          <div key={tab.id} role="tabpanel" data-slot="tabs-content" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== current.id}>
            {tab.render()}
          </div>
        ))}
    </div>
  )
}
