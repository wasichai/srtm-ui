import { ChevronRight } from 'lucide-react'
import { useLocation } from 'react-router'

// the srtm's trail over each screen: "registro tributario y determinación > registro tributario > registro de
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

// a strip under the workspace tabs; as a line (the portal), plain text atop the content, 8px over the page
export function Breadcrumbs({ linea = false }: { linea?: boolean }) {
  const { pathname } = useLocation()
  const pantalla = PANTALLAS.find(([pattern]) => pattern.test(pathname))?.[1]
  if (!pantalla) return null
  const pasos = [...RAIZ, pantalla]
  const ultimo = linea ? 'flex items-center gap-1 font-bold text-ink' : 'flex items-center gap-1 font-semibold text-ink'
  return (
    <nav aria-label="Ruta" className={linea ? 'mb-2 text-xs text-ink-muted' : 'border-b border-border bg-surface px-6 py-2 text-xs text-ink-muted'}>
      <ol className="flex flex-wrap items-center gap-1">
        {pasos.map((paso, i) => (
          <li key={paso} aria-current={i === pasos.length - 1 ? 'page' : undefined} className={i === pasos.length - 1 ? ultimo : 'flex items-center gap-1'}>
            {i > 0 && <ChevronRight aria-hidden className="size-3 text-ink-muted" />}
            {paso}
          </li>
        ))}
      </ol>
    </nav>
  )
}
