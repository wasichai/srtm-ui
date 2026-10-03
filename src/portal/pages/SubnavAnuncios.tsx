import { cn } from '@wasichai/ui'
import { NavLink } from 'react-router'

// the anuncios' pages, one from another: the classic menu has a single entry for them, in the order of the tree
// menu's group (NAV_TREE)
const PAGINAS = [
  { to: '/anuncios', label: 'Padrón de anuncios' },
  { to: '/anuncios/nuevo', label: 'Nuevo anuncio' },
  { to: '/anuncios/tasas', label: 'Tasas de anuncios' }
]

export function SubnavAnuncios() {
  return (
    <nav aria-label="Anuncios y propaganda" className="flex flex-wrap gap-4 text-sm">
      {PAGINAS.map(({ to, label }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => cn('hover:underline', isActive ? 'font-semibold text-ink' : 'text-link')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
