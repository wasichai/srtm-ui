import { cn } from '@wasichai/ui'
import { LogOut, Settings } from 'lucide-react'
import { useSession } from '../auth/session'
import { initials } from './comun'
import { useMenuButton } from './useMenuButton'

const ITEM = 'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-brand-soft focus-visible:bg-brand-soft focus-visible:-outline-offset-2'

// the brand bar's session menu: initials, name and role on the button (for the bar's colours); a panel with who is
// signed in, the administration (admins only) and sign-out. a menu button like ThemeMenu (useMenuButton): the arrows,
// home and end walk it, escape gives focus back to the button, a pick or a press anywhere else closes it.
// the panel's data-ui hooks let a theme refine it (src/themes/portal-tributario/shell.css)
export function MenuSesion() {
  const { user, isAdmin, signOut } = useSession()
  const { open, setOpen, rootProps, buttonProps, menuProps } = useMenuButton({ rol: 'menuitem' })
  const nombre = user?.displayName ?? user?.email ?? ''
  const rol = isAdmin ? 'Administrador' : 'Usuario'

  return (
    <div {...rootProps} className="relative">
      <button
        {...buttonProps}
        type="button"
        aria-label={`${nombre}, ${rol}: menú de sesión`}
        className="group flex items-center gap-2 rounded-md py-1 pr-2 pl-1 text-left hover:bg-shell-ink/10 focus-visible:outline-shell-ink"
      >
        {/* 15% white, not the prototype's 22%: white initials on it keep 4.5:1 */}
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-shell-ink/15 text-xs font-bold">
          {initials(nombre)}
        </span>
        <span className="leading-tight max-[860px]:hidden">
          <span className="block max-w-40 truncate text-[13px] font-bold">{nombre}</span>
          <span className="block text-[11px] text-shell-muted group-hover:text-shell-ink">{rol}</span>
        </span>
      </button>
      {open && (
        <div
          data-ui="menu-sesion-panel"
          className="absolute top-full right-0 z-30 mt-1 w-67 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-border bg-surface text-ink shadow-lg"
        >
          <div data-ui="menu-sesion-cabecera" className="border-b border-border bg-surface-muted px-4 py-3">
            <p className="truncate text-sm font-bold">{nombre}</p>
            {user?.email && <p className="truncate text-xs text-ink-muted">{user.email}</p>}
          </div>
          <div {...menuProps} aria-label="Sesión" className="py-1">
            {isAdmin && (
              <a href="/admin" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={cn(ITEM, 'text-link')}>
                <Settings aria-hidden className="size-4" />
                Administración
              </a>
            )}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className={cn(ITEM, 'text-danger')}
            >
              <LogOut aria-hidden className="size-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
