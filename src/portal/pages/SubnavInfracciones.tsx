import { cn } from '@wasichai/ui'
import { NavLink } from 'react-router'

// the infracciones administrativas' pages, one from another: the classic menu has a single entry for them. each PR
// of the épica adds its page here, in the order of the tree menu's group (NAV_TREE)
const PAGINAS = [{ to: '/infracciones/cuis', label: 'CUIS' }]

export function SubnavInfracciones() {
  return (
    <nav aria-label="Infracciones administrativas" className="flex flex-wrap gap-4 text-sm">
      {PAGINAS.map(({ to, label }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => cn('hover:underline', isActive ? 'font-semibold text-ink' : 'text-link')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
