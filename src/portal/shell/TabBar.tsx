import { cn } from '@wasichai/ui'
import { FileText, Gavel, Home, LandPlot, MapPinned, User, X, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useWorkspaceTabs, type WorkspaceTab } from './WorkspaceTabs'

// every kind of ficha has its icon: a new kind does not compile without one
const ICONOS: Record<WorkspaceTab['kind'], LucideIcon> = {
  contribuyente: User,
  predio: MapPinned,
  declaracion: FileText,
  lote: LandPlot,
  expediente: Gavel
}

// folder tabs over the content: Inicio always first and never closes, then one per open ficha
export function TabBar() {
  const { tabs, close } = useWorkspaceTabs()
  const { pathname } = useLocation()
  const tabClass = (active: boolean) =>
    cn(
      'group flex shrink-0 items-center rounded-t-md border border-b-0 text-sm',
      active ? 'border-border bg-surface-muted font-medium text-ink' : 'border-transparent text-ink-muted hover:bg-surface-muted/60'
    )

  return (
    <nav aria-label="Fichas abiertas" data-ui="workspace-tabs" className="border-b border-border bg-surface px-4">
      <ul className="flex gap-1 overflow-x-auto pt-2">
        <li data-ui="workspace-tab" className={tabClass(pathname === '/')}>
          <Link to="/" aria-current={pathname === '/' ? 'page' : undefined} className="flex items-center gap-1.5 px-3 py-1.5">
            <Home className="size-3.5" />
            Inicio
          </Link>
        </li>
        {tabs.map((tab) => {
          const active = pathname === tab.path
          // a tab stored by an older build may carry a kind this one does not know
          const Icon = ICONOS[tab.kind] ?? User
          return (
            <li key={tab.path} data-ui="workspace-tab" className={tabClass(active)}>
              <Link to={tab.path} aria-current={active ? 'page' : undefined} className="flex max-w-56 items-center gap-1.5 py-1.5 pr-1 pl-3">
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </Link>
              <button
                type="button"
                onClick={() => close(tab.path)}
                aria-label={`Cerrar ${tab.label}`}
                className="mr-1 rounded p-1 text-ink-muted hover:bg-border hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
