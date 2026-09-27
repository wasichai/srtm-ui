import { cn } from '@wasichai/ui'

export interface Paso<T extends string = string> {
  id: T
  label: string
}

// a wizard's steps as chevrons (the portal-tributario prototype): an ordered list, the current step marked with
// aria-current="step" in the brand and the others muted. a step it can go to (with onIr, and puedeIr when given) is a
// button; the rest, the current one too, are text: nothing to click, nothing to focus. the chevron's cut and the
// prototype's measures are the theme's (src/themes/portal-tributario/pasos.css, on data-ui). on a narrow screen the
// steps scroll sideways
export function PasosGalon<T extends string>({
  pasos,
  actual,
  onIr,
  puedeIr,
  label = 'Pasos del trámite'
}: {
  pasos: readonly Paso<T>[]
  actual: T
  onIr?: (id: T) => void
  puedeIr?: (id: T) => boolean
  label?: string
}) {
  return (
    <ol data-ui="pasos-galon" aria-label={label} className="flex overflow-x-auto">
      {pasos.map((paso) => {
        const esActual = paso.id === actual
        const ir = !esActual && onIr && (puedeIr?.(paso.id) ?? true) ? onIr : undefined
        return (
          <li
            key={paso.id}
            data-ui="paso"
            aria-current={esActual ? 'step' : undefined}
            className={cn('shrink-0 whitespace-nowrap', esActual ? 'bg-brand text-on-brand' : 'bg-surface-muted text-ink-muted')}
          >
            {ir ? (
              // the theme cuts the step, and its focus ring with it: the ring goes around the label, inside the cut
              <button type="button" onClick={() => ir(paso.id)} className="group block px-5 py-2.5 hover:underline focus-visible:outline-none">
                <span className="rounded-sm outline-offset-2 outline-current group-focus-visible:outline-2">{paso.label}</span>
              </button>
            ) : (
              <span className="block px-5 py-2.5">{paso.label}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
