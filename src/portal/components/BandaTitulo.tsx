import { cn } from '@wasichai/ui'
import type { ReactNode } from 'react'

// a figure of the band's summary: what the classic page shows as a StatCard. nota is what the card writes under it
// (what the figure means, the day it holds at), here a short suffix
export interface Cifra {
  label: string
  value: string
  nota?: ReactNode
}

interface BandaTituloProps {
  // what the form is about, small before the title: "Contribuyente Nº 000012"
  kind?: ReactNode
  title: ReactNode
  // after the title: the srtm's name of the form ("Insertar contribuyente")
  detalle?: ReactNode
  // the "?" of the prototype: only when there is a help to show
  ayuda?: () => void
  // the ficha's figures (the year's predios, autoavalúo…), on the right
  resumen?: Cifra[]
}

// the form's title band of the portal-tributario theme (useVarianteTema() === 'portal'): the h1 in on-brand over the
// brand, the kind before it on the same line, the summary's figures on the right (under the title where it is narrow).
// the prototype's favourites star is left out: there is no backend for it
export function BandaTitulo({ kind, title, detalle, ayuda, resumen }: BandaTituloProps) {
  const cifras = resumen !== undefined && resumen.length > 0
  return (
    <div
      data-ui="banda-titulo"
      className={cn('flex items-center', cifras ? 'flex-wrap gap-x-6 gap-y-2' : 'gap-3', 'rounded-sm bg-brand px-4 py-[11px] text-on-brand')}
    >
      {/* with figures, the title keeps 20rem before they wrap under it */}
      <div className={cn('flex min-w-0', cifras ? 'grow basis-80' : 'flex-1', 'flex-wrap items-baseline gap-x-3 gap-y-0.5')}>
        {kind && <p className="text-xs font-semibold tracking-wide uppercase">{kind}</p>}
        <h1 className="text-[18px] leading-[1.45] font-bold break-words">{title}</h1>
        {detalle && <p className="ml-auto text-xs font-semibold tracking-wide uppercase italic">{detalle}</p>}
      </div>
      {cifras && (
        // white on the brand (4.68:1), each figure after a line of 40% white
        <dl data-ui="banda-resumen" className="flex flex-wrap gap-y-1.5">
          {resumen.map(({ label, value, nota }) => (
            <div key={label} className="border-l border-on-brand/40 px-4 last:pr-0">
              <dt className="text-xs font-bold tracking-wide uppercase">{label}</dt>
              <dd className="text-[18px] leading-[1.25] font-bold">
                {value}
                {nota && (
                  <>
                    {' '}
                    <span className="text-xs font-normal">{nota}</span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {ayuda && (
        <button
          type="button"
          aria-label="Ayuda de este formulario"
          onClick={ayuda}
          className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-surface text-[13px] leading-none font-bold text-brand hover:bg-brand-soft"
        >
          ?
        </button>
      )}
    </div>
  )
}

// the band and, in a row right under it, what goes with the title: badges on the left, actions on the right. the
// page's folder tabs hang from it (banda.css)
export function CabeceraBanda({ badges, aside, ...banda }: BandaTituloProps & { badges?: ReactNode; aside?: ReactNode }) {
  return (
    <div data-ui="cabecera-banda">
      <BandaTitulo {...banda} />
      {(badges || aside) && (
        <div data-ui="cabecera-fila" className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5">
          {badges && <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-muted">{badges}</div>}
          {aside && <div className="ml-auto">{aside}</div>}
        </div>
      )}
    </div>
  )
}
