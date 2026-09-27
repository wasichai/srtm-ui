import type { ReactNode } from 'react'
import { useVarianteTema } from '../../themes'
import { CabeceraBanda } from '../components/BandaTitulo'

interface CabeceraAsistenteProps {
  // what the wizard works on, before the title: its contribuyente or its predio
  kind?: ReactNode
  title: string
  // the srtm's name of the form
  detalle: string
  // the wizard's buttons (Cancelar, Siguiente), in their order
  children: ReactNode
}

// a wizard's header: portal-tributario puts the title and its subtitles in the title band and the buttons in a row
// under it; light and dark keep the header of always
export function CabeceraAsistente({ kind, title, detalle, children }: CabeceraAsistenteProps) {
  const variante = useVarianteTema()
  const acciones = <div className="flex gap-2">{children}</div>
  if (variante === 'portal') return <CabeceraBanda kind={kind} title={title} detalle={detalle} aside={acciones} />
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {kind && <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{kind}</p>}
        <h1 className="text-xl font-semibold text-ink uppercase">{title}</h1>
        <p className="text-xs font-semibold tracking-wide text-brand uppercase italic">{detalle}</p>
      </div>
      {acciones}
    </div>
  )
}
