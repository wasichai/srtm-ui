import { cn } from '@wasichai/ui'
import { Home, Landmark, LogOut, MapPinned, Menu, Search, Settings, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '../auth/session'
import { Breadcrumbs } from './Breadcrumbs'
import { TabBar } from './TabBar'
import { ThemeMenu } from './ThemeMenu'

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/contribuyentes', label: 'Contribuyentes', icon: Users, end: false },
  { to: '/predios', label: 'Predios', icon: MapPinned, end: false }
]

// gisxp's shell: light header with the search in the middle, dark sidebar, workspace tabs over the content
export function AppShell() {
  const { user, isAdmin, signOut } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
        <button
          type="button"
          className="rounded p-1.5 text-ink-muted hover:bg-surface-muted md:hidden"
          aria-label="Menú"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <Landmark className="size-5 text-brand" />
          <span className="text-sm font-bold text-brand">Rentas municipales</span>
          <span className="hidden truncate text-sm text-ink-muted lg:inline">Municipalidad Distrital de Perené</span>
        </div>
        <div className="flex flex-1 justify-center">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a
              href="/admin"
              className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink sm:flex"
            >
              <Settings className="size-4" />
              Administración
            </a>
          )}
          <ThemeMenu />
          <span title={user?.email} className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
            {initials(user?.displayName ?? user?.email ?? '')}
          </span>
          <button type="button" onClick={signOut} aria-label="Cerrar sesión" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav id="sidebar" aria-label="Secciones" className={cn('w-60 shrink-0 bg-shell p-3 md:block', menuOpen ? 'block' : 'hidden')}>
          <ul className="space-y-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
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
        <main id="content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TabBar />
          <Breadcrumbs />
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const q = text.trim()
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`)
  }
  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        aria-label="Buscar"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="DNI, RUC, nombre, código o dirección"
        className="h-9 w-full rounded-md border border-border bg-surface-muted pr-3 pl-9 text-sm placeholder:text-ink-muted/70 focus:bg-surface"
      />
    </form>
  )
}

function initials(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
