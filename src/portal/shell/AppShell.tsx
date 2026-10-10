import { cn } from '@wasichai/ui'
import { Landmark, LogOut, Menu, Settings } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useVarianteTema } from '../../themes'
import { useSession } from '../auth/session'
import { Breadcrumbs } from './Breadcrumbs'
import { ENTIDAD, GlobalSearch, initials, NAV, type LateralProps, type PiezasShell } from './comun'
import { usePanelLateral } from './panelLateral'
import { PortalShell } from './PortalShell'
import { TabBar } from './TabBar'
import { ThemeMenu } from './ThemeMenu'

// gisxp's shell: light header with the search in the middle, dark sidebar, workspace tabs over the content.
// under the portal-tributario theme it delegates to PortalShell (brand bar, the tree of trámites, footer). one frame for
// both, each variant bringing its pieces: a theme switch redraws the bar, the lateral and the footer but keeps the
// page (and whatever is not saved in it) and the theme menu, with its focus and its error, mounted
export function AppShell() {
  const { isAdmin } = useSession()
  const piezas = useVarianteTema() === 'portal' ? PortalShell : CLASICO
  const { Marca, Sesion, Lateral, Pie } = piezas
  const lateral = usePanelLateral(piezas.plegable === true)
  const contenido = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  // the screens scroll in their own box, which the router does not reset: another screen starts at its top. another
  // tab of the same ficha (?tab=) keeps its place
  useLayoutEffect(() => {
    if (contenido.current) contenido.current.scrollTop = 0
  }, [pathname])

  return (
    <div className="flex h-full flex-col">
      <SaltarAlContenido />
      <header className={piezas.cabecera}>
        <button
          ref={lateral.boton}
          type="button"
          className={piezas.botonMenu}
          // a foldable lateral folds itself: this one only brings it back
          hidden={piezas.plegable && lateral.abierto}
          aria-label={piezas.plegable ? 'Mostrar el menú' : 'Menú'}
          aria-expanded={lateral.abierto}
          aria-controls="sidebar"
          onClick={lateral.alternar}
        >
          <Menu className="size-5" />
        </button>
        <Marca />
        <div className="flex flex-1 justify-center">
          <GlobalSearch className={piezas.buscador} inputClassName={piezas.busqueda} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && piezas.admin && (
            <a href="/admin" className={piezas.admin}>
              <Settings className="size-4" />
              Administración
            </a>
          )}
          <ThemeMenu className={piezas.tema} />
          <Sesion />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Lateral abierto={lateral.abierto} onNavegar={lateral.alNavegar} onPlegar={lateral.plegar} />
        <main id="content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TabBar />
          {!piezas.rutaEnContenido && <Breadcrumbs />}
          <div ref={contenido} id="contenido" tabIndex={-1} className="min-h-0 flex-1 overflow-auto px-6 py-5 outline-none">
            {/* the trail's slot before the page in both variants: a theme switch keeps the page mounted */}
            {piezas.rutaEnContenido && <Breadcrumbs linea />}
            <Outlet />
          </div>
        </main>
      </div>
      {Pie && <Pie />}
    </div>
  )
}

// the keyboard's first stop, shown only while it has the focus: past the header, the menu, the workspace tabs and the
// trail (under the portal the trail is the first line of the screen's own box), to the screen itself (wcag 2.4.1). it
// moves the focus, not the url: a #hash is a navigation to the router
function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      onClick={(event) => {
        event.preventDefault()
        document.getElementById('contenido')?.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
    >
      Saltar al contenido
    </a>
  )
}

const CLASICO: PiezasShell = {
  cabecera: 'flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4',
  botonMenu: 'rounded p-1.5 text-ink-muted hover:bg-surface-muted md:hidden',
  admin: 'hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink sm:flex',
  Marca: MarcaClasica,
  Sesion: SesionClasica,
  Lateral: LateralClasico
}

function MarcaClasica() {
  return (
    <div className="flex items-center gap-2">
      <Landmark className="size-5 text-brand" />
      <span className="text-sm font-bold text-brand">Rentas municipales</span>
      <span className="hidden truncate text-sm text-ink-muted lg:inline">{ENTIDAD}</span>
    </div>
  )
}

function SesionClasica() {
  const { user, signOut } = useSession()
  return (
    <>
      <span title={user?.email} className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
        {initials(user?.displayName ?? user?.email ?? '')}
      </span>
      <button type="button" onClick={signOut} aria-label="Cerrar sesión" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink">
        <LogOut className="size-4" />
      </button>
    </>
  )
}

function LateralClasico({ abierto, onNavegar }: LateralProps) {
  return (
    <nav id="sidebar" aria-label="Secciones" className={cn('w-60 shrink-0 bg-shell p-3 md:block', abierto ? 'block' : 'hidden')}>
      <ul className="space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavegar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-shell-ink/10 text-shell-ink' : 'text-shell-muted hover:bg-shell-ink/5 hover:text-shell-ink'
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
