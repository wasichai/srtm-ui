import { cn } from '@wasichai/ui'
import { Landmark, LogOut, Menu as IconoMenu, Settings } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useVarianteTema } from '../../themes'
import { useSession } from '../auth/session'
import { Breadcrumbs } from './Breadcrumbs'
import { ENTIDAD, GlobalSearch, initials, NAV, type LateralProps, type PiezasShell } from './comun'
import { PortalShell } from './PortalShell'
import { TabBar } from './TabBar'
import { ThemeMenu } from './ThemeMenu'

// gisxp's shell: light header with the search in the middle, dark sidebar, workspace tabs over the content.
// under the portal-tributario theme it delegates to PortalShell (brand bar, the menu bar of trámites, footer). one
// frame for both, each variant bringing its pieces: a theme switch redraws the bar, the menu and the footer but keeps
// the page (and whatever is not saved in it) and the theme menu, with its focus and its error, mounted. a piece a
// variant does not have leaves its place empty, so what follows keeps its place too
export function AppShell() {
  const { isAdmin } = useSession()
  // the classic lateral opens only on a phone, from the header, and closes on a pick
  const [lateralAbierto, setLateralAbierto] = useState(false)
  const piezas = useVarianteTema() === 'portal' ? PortalShell : CLASICO
  const { Marca, Sesion, Menu, Lateral, Pie } = piezas

  return (
    <div className="flex h-full flex-col">
      <header className={piezas.cabecera}>
        {Lateral && (
          <button
            type="button"
            className={piezas.botonMenu}
            aria-label="Menú"
            aria-expanded={lateralAbierto}
            aria-controls="sidebar"
            onClick={() => setLateralAbierto((abierto) => !abierto)}
          >
            <IconoMenu className="size-5" />
          </button>
        )}
        <Marca />
        <div className="flex flex-1 justify-center">
          <GlobalSearch inputClassName={piezas.busqueda} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a href="/admin" className={piezas.admin}>
              <Settings className="size-4" />
              Administración
            </a>
          )}
          <ThemeMenu className={piezas.tema} />
          <Sesion />
        </div>
      </header>
      {Menu && <Menu />}
      <div className="flex min-h-0 flex-1">
        {Lateral && <Lateral abierto={lateralAbierto} onNavegar={() => setLateralAbierto(false)} />}
        <main id="content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TabBar />
          <Breadcrumbs />
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <Outlet />
          </div>
        </main>
      </div>
      {Pie && <Pie />}
    </div>
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
