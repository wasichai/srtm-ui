import type { ReactNode } from 'react'
import { useRuta } from '../shell/Breadcrumbs'

interface BandaTituloProps {
  // what the form is about, small before the title: "Contribuyente Nº 000012"
  kind?: ReactNode
  title: ReactNode
  // after the title: the srtm's name of the form ("Insertar contribuyente")
  detalle?: ReactNode
  // the trail to the page (useRuta): its last two steps where the detail goes, when there is none. the portal has no
  // strip over the page for it
  ruta?: string[]
  // the "?" of the prototype: only when there is a help to show
  ayuda?: () => void
}

// on the right of the title: small, in capitals and italics
const DETALLE = 'ml-auto text-xs font-semibold tracking-wide uppercase italic'

// the form's title band of the portal-tributario theme (useVarianteTema() === 'portal'): the h1 in on-brand over the
// brand, the kind before it on the same line. the prototype's favourites star is left out: there is no backend for it
export function BandaTitulo({ kind, title, detalle, ruta, ayuda }: BandaTituloProps) {
  return (
    <div data-ui="banda-titulo" className="flex items-center gap-3 rounded-sm bg-brand px-4 py-[11px] text-on-brand">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {kind && <p className="text-xs font-semibold tracking-wide uppercase">{kind}</p>}
        <h1 className="text-[18px] leading-[1.45] font-bold break-words">{title}</h1>
        {detalle && <p className={DETALLE}>{detalle}</p>}
        {!detalle && !!ruta?.length && (
          <nav aria-label="Ruta" className={DETALLE}>
            {ruta.slice(-2).join(' › ')}
          </nav>
        )}
      </div>
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

// the band, with the trail of its page, and, in a row right under it, what goes with the title: badges on the left,
// actions on the right. the page's folder tabs hang from it (banda.css)
export function CabeceraBanda({ badges, aside, ...banda }: BandaTituloProps & { badges?: ReactNode; aside?: ReactNode }) {
  const ruta = useRuta()
  return (
    <div data-ui="cabecera-banda">
      <BandaTitulo ruta={ruta} {...banda} />
      {(badges || aside) && (
        <div data-ui="cabecera-fila" className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5">
          {badges && <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-muted">{badges}</div>}
          {aside && <div className="ml-auto">{aside}</div>}
        </div>
      )}
    </div>
  )
}
