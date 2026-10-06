import { currentNavTreeLeaf, isNavTreeGroup, NavTree, navTreeLeaves } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { Home, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useSession } from '../auth/session'
import { arbolPara, NAV_TREE, type GrupoNav, type HojaNav } from './navTree'

// the open group's trámites: one panel at a time, so one id for every group's button
const PANEL = 'sidebar-tramites'

// an item: the icon over the label, stacked and centred; the section on screen marked on its left. the greys the
// tokens do not say are shell.css's, as nav.css gives core's tree its own
const ITEM = 'flex w-full flex-col items-center gap-1 border-l-4 px-1 py-2.5 text-center text-[11.5px] leading-[1.2] text-ink focus-visible:-outline-offset-2'
const estado = (actual: boolean) => (actual ? 'border-link bg-ink/6 font-bold' : 'border-transparent hover:bg-ink/4')

// the portal's lateral (portal-tributario theme): a narrow rail of modules over table-head. Inicio, one button per
// group of the tree of trámites (NAV_TREE: the administration for admins only) and the root leaves last, after a
// line. a group opens its trámites in a panel beside the rail, core's NavTree with the group's leaves: right after
// its button, so they come next from the keyboard. one at a time; escape (focus back on its button), a press
// elsewhere, a pick or another route closes it. it never folds: on a phone it spans the row and wraps its items
export function RielPortal() {
  const { isAdmin } = useSession()
  const { pathname } = useLocation()
  const nodos = useMemo(() => arbolPara(NAV_TREE, { isAdmin }), [isAdmin])
  const grupos = nodos.filter((nodo): nodo is GrupoNav => isNavTreeGroup(nodo))
  const hojas = nodos.filter((nodo): nodo is HojaNav => !isNavTreeGroup(nodo))
  const actual = currentNavTreeLeaf(nodos, pathname)
  const seccion = actual && grupos.find((grupo) => navTreeLeaves(grupo.children).includes(actual))

  const riel = useRef<HTMLElement>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  // its subgroups, if a group had any (none today): open unless folded, for the panel's life
  const [subgrupos, setSubgrupos] = useState<Record<string, boolean>>({})
  const abrir = (grupo: string | null) => {
    setAbierto(grupo)
    setSubgrupos({})
  }

  // another route closes it, whatever took there
  const [ruta, setRuta] = useState(pathname)
  if (ruta !== pathname) {
    setRuta(pathname)
    abrir(null)
  }

  // a press anywhere but the rail and its panel closes it
  useEffect(() => {
    if (!abierto) return
    const fuera = (event: PointerEvent) => {
      if (!riel.current?.contains(event.target as Node)) setAbierto(null)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  // focus goes back to the group's button
  const cerrar = () => {
    riel.current?.querySelector<HTMLElement>('[data-ui="riel-item"][aria-expanded="true"]')?.focus()
    abrir(null)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !abierto) return
    event.preventDefault()
    cerrar()
  }

  return (
    <nav
      ref={riel}
      id="sidebar"
      aria-label="Secciones"
      data-ui="riel"
      onKeyDown={onKeyDown}
      className="relative flex w-26 shrink-0 flex-col border-r border-border bg-table-head print:hidden max-sm:w-full max-sm:border-r-0 max-sm:border-b"
    >
      <ul className="flex min-h-0 flex-1 flex-wrap content-start overflow-y-auto py-2">
        <li className="w-25">
          <NavLink to="/" end data-ui="riel-item" className={({ isActive }) => cn(ITEM, estado(isActive))}>
            <Icono icon={Home} />
            Inicio
          </NavLink>
        </li>
        {grupos.map((grupo) => {
          const abre = abierto === grupo.label
          return (
            <li key={grupo.label} className="w-25">
              <button
                type="button"
                data-ui="riel-item"
                aria-expanded={abre}
                aria-controls={PANEL}
                aria-current={grupo === seccion ? 'true' : undefined}
                onClick={() => abrir(abre ? null : grupo.label)}
                className={cn(ITEM, estado(grupo === seccion), abre && 'bg-surface')}
              >
                <Icono icon={grupo.icon} />
                {grupo.corto ?? grupo.label}
              </button>
              {abre && (
                <Panel>
                  <NavTree
                    id={PANEL}
                    label={`Trámites: ${grupo.label}`}
                    title={grupo.label}
                    nodes={grupo.children}
                    homeTo="/"
                    open
                    groups={subgrupos}
                    onToggleGroup={(clave) => setSubgrupos((antes) => ({ ...antes, [clave]: antes[clave] === false }))}
                    onNavigate={() => abrir(null)}
                    onFold={cerrar}
                  />
                </Panel>
              )}
            </li>
          )
        })}
        {hojas.map((hoja, i) => {
          // another app (the administration) is a plain link, loaded in full and never current
          const props = {
            'data-ui': 'riel-item',
            'aria-current': hoja === actual ? ('page' as const) : undefined,
            className: cn(ITEM, estado(hoja === actual))
          }
          const contenido = (
            <>
              {hoja.icon && <Icono icon={hoja.icon} />}
              {hoja.label}
            </>
          )
          return (
            <li key={hoja.to} className={cn('w-25', i === 0 && 'mt-2 border-t border-border pt-2')}>
              {hoja.external ? (
                <a href={hoja.to} {...props}>
                  {contenido}
                </a>
              ) : (
                <Link to={hoja.to} {...props}>
                  {contenido}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Icono({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden className="size-5 shrink-0 text-ink-muted" strokeWidth={1.9} />
}

// beside the rail, from the top of the row to its bottom, over the content (the tree scrolls in it); on a phone,
// under the rail and as wide as it. the shadow is shell.css's
function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      data-ui="riel-panel"
      className="absolute top-0 bottom-0 left-full z-20 grid grid-rows-[minmax(0,1fr)] shadow-lg max-sm:top-full max-sm:right-0 max-sm:bottom-auto max-sm:left-0 max-sm:max-h-[70vh]"
    >
      {children}
    </div>
  )
}
