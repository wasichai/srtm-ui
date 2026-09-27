import type { ReactNode } from 'react'
import { useVarianteTema } from '../../themes'
import { CabeceraBanda } from '../components/BandaTitulo'

interface FichaHeaderProps {
  kind: ReactNode
  title: string
  badges?: ReactNode
  aside?: ReactNode
  // the band's "?" (portal-tributario only)
  ayuda?: () => void
}

// portal-tributario opens the ficha with its title band, the badges and the actions in a row under it; light and dark
// keep this header
export function FichaHeader({ kind, title, badges, aside, ayuda }: FichaHeaderProps) {
  const variante = useVarianteTema()
  if (variante === 'portal') return <CabeceraBanda kind={kind} title={title} badges={badges} aside={aside} ayuda={ayuda} />
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{kind}</p>
        <h1 className="mt-0.5 text-xl font-semibold break-words text-ink">{title}</h1>
        {badges && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">{badges}</div>}
      </div>
      {aside}
    </div>
  )
}
