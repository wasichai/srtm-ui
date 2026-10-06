import { currentNavTreeLeaf, isNavTreeGroup, navTreeLeaves } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { ChevronDown, ChevronRight, Home } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useSession } from '../auth/session'
import { arbolPara, NAV_TREE, type GrupoNav, type HojaNav, type NodoNav } from './navTree'

// an item of the bar: one line, 16px, a 3px line below that marks the current one, 1px sides that show while its panel
// is open. the ring inside: the bar wraps, its items touch
const ITEM =
  'flex h-full items-center gap-1.5 border-x border-b-3 border-transparent px-[13px] pt-[11px] pb-2 text-base leading-[1.45] whitespace-nowrap focus-visible:-outline-offset-2'

// the portal's menu (portal-tributario theme): the tree of trámites (NAV_TREE, the administration for admins only) as
// a bar under the brand bar
export function MenuPortal() {
  const { isAdmin } = useSession()
  const nodos = useMemo(() => arbolPara(NAV_TREE, { isAdmin }), [isAdmin])
  return <MenuSecciones nodos={nodos} />
}

// home, then a dropdown per group (a disclosure: navigation, not role="menu"), then the leaves of the root at the far
// right. the group that holds the page's leaf is marked. one panel open at a time; a pick, a press outside, escape,
// the focus leaving the bar or a route change close it. the data-ui hooks let the theme pin its greys (menu.css)
export function MenuSecciones({ nodos }: { nodos: NodoNav[] }) {
  const { pathname } = useLocation()
  const actual = currentNavTreeLeaf(nodos, pathname)
  const [abierto, setAbierto] = useState<string | null>(null)
  const cerrar = useCallback(() => setAbierto(null), [])
  // a route change closes it: a pick, a workspace tab, the browser's back
  const [ruta, setRuta] = useState(pathname)
  if (ruta !== pathname) {
    setRuta(pathname)
    setAbierto(null)
  }

  const grupos = nodos.filter((nodo): nodo is GrupoNav => isNavTreeGroup(nodo))
  const hojas = nodos.filter((nodo): nodo is HojaNav => !isNavTreeGroup(nodo))

  return (
    <nav
      aria-label="Secciones"
      data-ui="menu-portal"
      // over the page, which its panels cover
      className="relative z-10 shrink-0 border-b border-border bg-table-head px-4 print:hidden"
      // the focus gone past the bar. a click may blur with no target (safari): the press outside closes it then
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) cerrar()
      }}
    >
      <ul className="flex flex-wrap">
        <li>
          <NavLink to="/" end className={cn(ITEM, 'text-link hover:underline aria-[current=page]:border-b-link')}>
            <Home aria-hidden className="size-4 shrink-0" strokeWidth={1.9} />
            Inicio
          </NavLink>
        </li>
        {grupos.map((grupo) => (
          <Grupo
            key={grupo.label}
            grupo={grupo}
            actual={actual}
            abierto={abierto === grupo.label}
            onAlternar={() => setAbierto((era) => (era === grupo.label ? null : grupo.label))}
            onCerrar={cerrar}
          />
        ))}
        {hojas.map((hoja, i) => {
          const Icon = hoja.icon
          return (
            <li key={hoja.to} className={cn(i === 0 && 'ml-auto')}>
              {/* the group's type, its icon where a group has the caret */}
              <Enlace
                hoja={hoja}
                data-ui="menu-grupo"
                aria-current={hoja === actual ? 'page' : undefined}
                className={cn(ITEM, 'font-bold', hoja === actual ? 'border-b-link text-link' : 'text-ink hover:text-link')}
              >
                {Icon && <Icon aria-hidden data-ui="menu-caret" className="size-4 shrink-0 text-ink-muted" />}
                {hoja.label}
              </Enlace>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

interface GrupoProps {
  grupo: GrupoNav
  actual: HojaNav | undefined
  abierto: boolean
  onAlternar: () => void
  onCerrar: () => void
}

// a group: its button (the short label, if it has one; the full one names it) and its panel right under it, headed by
// the full label. the panel is next in the tab order
function Grupo({ grupo, actual, abierto, onAlternar, onCerrar }: GrupoProps) {
  const id = useId()
  const raiz = useRef<HTMLLIElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const marcado = actual !== undefined && navTreeLeaves(grupo.children).includes(actual)

  // open, a press anywhere else closes it (another group's button opens that one)
  useEffect(() => {
    if (!abierto) return
    const fuera = (event: PointerEvent) => {
      if (!raiz.current?.contains(event.target as Node)) onCerrar()
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto, onCerrar])

  // where a group falls depends on how the bar wraps: a panel that would leave the screen on the right moves left, 8px
  // short of the edge. jsdom's documentElement has no width
  useLayoutEffect(() => {
    const caja = panel.current
    if (!abierto || !caja) return
    caja.style.left = ''
    const ancho = document.documentElement.clientWidth || window.innerWidth
    const sobra = caja.getBoundingClientRect().right - (ancho - 8)
    if (sobra > 0) caja.style.left = `${-sobra}px`
  }, [abierto])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !abierto) return
    event.preventDefault()
    onCerrar()
    boton.current?.focus()
  }

  return (
    <li ref={raiz} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={boton}
        type="button"
        data-ui="menu-grupo"
        aria-label={grupo.corto ? grupo.label : undefined}
        aria-expanded={abierto}
        aria-controls={id}
        aria-current={marcado ? 'true' : undefined}
        onClick={onAlternar}
        className={cn(ITEM, 'font-bold', marcado ? 'border-b-link text-link' : 'text-ink hover:text-link', abierto && 'border-x-border bg-surface')}
      >
        {grupo.corto ?? grupo.label}
        <ChevronDown
          aria-hidden
          data-ui="menu-caret"
          className={cn('size-4 shrink-0 text-ink-muted transition-transform duration-130 motion-reduce:transition-none', abierto && 'rotate-180')}
        />
      </button>
      {/* white under its button, no border on top: the two read as one */}
      <div
        ref={panel}
        id={id}
        hidden={!abierto}
        data-ui="menu-panel"
        className="absolute top-full left-0 z-30 max-w-[calc(100vw-1rem)] min-w-70 rounded-b-sm border border-t-0 border-border bg-surface pt-1 pb-2.5 shadow-lg"
      >
        <p className="pt-2.5 pr-4 pb-1.5 pl-6 text-[17px] leading-[1.45] font-bold text-ink">{grupo.label}</p>
        <Hojas nodos={grupo.children} nivel={1} actual={actual} onElegir={onCerrar} />
      </div>
    </li>
  )
}

// a panel's leaves, as the tree's (15px in the link colour, the current one marked on its left, in bold and with a
// chevron); a subgroup is a heading over its leaves, these indented further
function Hojas({ nodos, nivel, actual, onElegir }: { nodos: NodoNav[]; nivel: number; actual: HojaNav | undefined; onElegir: () => void }) {
  return (
    <ul>
      {nodos.map((nodo) =>
        isNavTreeGroup(nodo) ? (
          <li key={nodo.label}>
            <p className={cn('pt-2 pr-4 pb-1 text-base leading-[1.45] font-bold text-ink', nivel > 1 ? 'pl-[38px]' : 'pl-6')}>{nodo.label}</p>
            <Hojas nodos={nodo.children} nivel={nivel + 1} actual={actual} onElegir={onElegir} />
          </li>
        ) : (
          <li key={nodo.to}>
            <Enlace
              hoja={nodo}
              data-ui="menu-hoja"
              aria-current={nodo === actual ? 'page' : undefined}
              onClick={onElegir}
              className={cn(
                'flex items-center gap-2 border-l-4 py-[9px] pr-4 text-[15px] leading-[1.35] text-link focus-visible:-outline-offset-2',
                nivel > 1 ? 'pl-[34px]' : 'pl-5',
                nodo === actual ? 'border-link bg-ink/6 font-bold' : 'border-transparent hover:bg-ink/4'
              )}
            >
              <span className="min-w-0 flex-1">{nodo.label}</span>
              {nodo === actual && <ChevronRight aria-hidden className="size-3.5 shrink-0" strokeWidth={3} />}
            </Enlace>
          </li>
        )
      )}
    </ul>
  )
}

// a page of the portal goes through the router; another app (external) is a plain link, loaded in full. Link, not
// NavLink: its prefix match would mark Buscar and Nuevo contribuyente at once, so aria-current comes from the rule
function Enlace({ hoja, ...props }: { hoja: HojaNav } & Omit<ComponentProps<'a'>, 'href'>) {
  return hoja.external ? <a href={hoja.to} {...props} /> : <Link to={hoja.to} {...props} />
}
