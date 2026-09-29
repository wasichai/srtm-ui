import { Button, cn } from '@wasichai/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface Herramienta {
  label: string
  icon: LucideIcon
  onClick: () => void
}

// the bar under a wizard's steps (the portal-tributario prototype): "Paso N:" in bold and what the step asks for,
// read out when it changes; on its right, optional tools: primary buttons, flat and side by side, a faint line between
// them. a line under it, as in the prototype. the prototype's measures are the theme's
// (src/themes/portal-tributario/pasos.css, on data-ui)
export function BarraInstruccion({
  paso,
  children,
  herramientas = [],
  className
}: {
  paso?: string
  children: ReactNode
  herramientas?: Herramienta[]
  className?: string
}) {
  return (
    <div data-ui="barra-instruccion" className={cn('flex flex-wrap items-stretch gap-x-3.5 border-b border-line bg-surface-muted pl-4 text-ink', className)}>
      <p aria-live="polite" className="min-w-55 flex-1 py-2.5 text-sm">
        {paso && (
          <>
            <strong>{paso}</strong>{' '}
          </>
        )}
        {children}
      </p>
      {herramientas.length > 0 && (
        <div className="flex items-stretch">
          {herramientas.map(({ label, icon: Icon, onClick }) => (
            <Button key={label} type="button" onClick={onClick} className="h-auto rounded-none border-l border-on-brand/30 py-2.5">
              <Icon aria-hidden className="size-4 shrink-0" />
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
