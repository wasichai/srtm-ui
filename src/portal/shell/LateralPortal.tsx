import { cn } from '@wasichai/ui'
import { NavLink } from 'react-router'
import { NAV, type LateralProps } from './comun'

// the portal's lateral, for now: the shell's sections (NAV) in the prototype's light column, links in the link
// colour and the current one marked on its left. the tree menu (issue #53) takes its place
export function LateralPortal({ abierto, onNavegar }: LateralProps) {
  return (
    <nav
      id="sidebar"
      aria-label="Secciones"
      className={cn('w-60 shrink-0 overflow-y-auto border-r border-border bg-table-head py-3 md:block lg:w-73 print:hidden', abierto ? 'block' : 'hidden')}
    >
      <ul>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavegar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 border-l-4 px-4 py-2 text-[15px] text-link hover:bg-ink/4 hover:underline focus-visible:-outline-offset-2',
                  isActive ? 'border-link bg-ink/6 font-bold' : 'border-transparent'
                )
              }
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
