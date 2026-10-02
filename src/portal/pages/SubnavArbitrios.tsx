import { cn } from '@wasichai/ui'
import { NavLink } from 'react-router'

// the arbitrios' pages, one from another: the classic menu has a single entry for them
const PAGINAS = [
  { to: '/arbitrios', label: 'Consulta de cuotas' },
  { to: '/arbitrios/tasas', label: 'Tasas del año' },
  { to: '/arbitrios/determinaciones', label: 'Determinación masiva' }
]

export function SubnavArbitrios() {
  return (
    <nav aria-label="Arbitrios" className="flex flex-wrap gap-4 text-sm">
      {PAGINAS.map(({ to, label }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => cn('hover:underline', isActive ? 'font-semibold text-ink' : 'text-link')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
