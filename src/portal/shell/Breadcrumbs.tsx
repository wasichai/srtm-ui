import { ChevronRight } from 'lucide-react'
import { useLocation } from 'react-router'

// the srtm's trail to each screen: "registro tributario y determinación > registro tributario > registro de
// contribuyente". its first two steps are the srtm's menu groups, not pages: plain text
const RAIZ = ['Registro tributario y determinación', 'Registro tributario']

const PANTALLAS: [RegExp, string][] = [
  [/^\/contribuyentes\/[^/]+\/declaraciones\/nueva$/, 'Declaración jurada predial'],
  [/^\/declaraciones\//, 'Declaración jurada predial'],
  [/^\/contribuyentes\/.+/, 'Registro de contribuyente'],
  [/^\/contribuyentes$/, 'Contribuyentes'],
  [/^\/predios\/.+/, 'Registro de predio'],
  [/^\/predios$/, 'Predios'],
  [/^\/catastro\//, 'Lote de catastro fiscal']
]

// the trail to the screen on the page, none for a screen the srtm has no name for. the classic shell draws it in a
// strip over the page (Breadcrumbs), the portal in the title band (CabeceraBanda)
export function useRuta(): string[] {
  const { pathname } = useLocation()
  const pantalla = PANTALLAS.find(([pattern]) => pattern.test(pathname))?.[1]
  return pantalla ? [...RAIZ, pantalla] : []
}

export function Breadcrumbs() {
  const pasos = useRuta()
  if (!pasos.length) return null
  return (
    <nav aria-label="Ruta" className="border-b border-border bg-surface px-6 py-2 text-xs text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {pasos.map((paso, i) => (
          <li
            key={paso}
            aria-current={i === pasos.length - 1 ? 'page' : undefined}
            className={i === pasos.length - 1 ? 'flex items-center gap-1 font-semibold text-ink' : 'flex items-center gap-1'}
          >
            {i > 0 && <ChevronRight aria-hidden className="size-3 text-ink-muted" />}
            {paso}
          </li>
        ))}
      </ol>
    </nav>
  )
}
