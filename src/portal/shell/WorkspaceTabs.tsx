import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { TABS_KEY, TABS_USER_KEY, useSession } from '../auth/session'

// the workspace tabs, like gisxp's: every ficha one opens stays a tab until it is closed, so a clerk
// attending several people keeps them all a click away. kept per browser tab (sessionStorage)

export interface WorkspaceTab {
  path: string
  label: string
  kind: 'contribuyente' | 'predio' | 'declaracion' | 'lote' | 'expediente'
}

interface WorkspaceTabs {
  tabs: WorkspaceTab[]
  open: (tab: WorkspaceTab) => void
  close: (path: string) => void
}

const Context = createContext<WorkspaceTabs | null>(null)

const esPestana = (valor: unknown): valor is WorkspaceTab => {
  const t = valor as Partial<WorkspaceTab> | null
  return typeof t === 'object' && t !== null && typeof t.path === 'string' && typeof t.label === 'string' && typeof t.kind === 'string'
}

// the tabs kept for this browser tab, if they are `usuario`'s: a session that ended without signing out here (it
// expired, or was closed in the admin) leaves its tabs behind, and the next clerk must not see whom the last one was
// attending. what is not a list of tabs (another build's, hand-edited) is left out
function load(usuario: string | undefined): WorkspaceTab[] {
  try {
    if (usuario !== undefined && sessionStorage.getItem(TABS_USER_KEY) !== usuario) return []
    const stored: unknown = JSON.parse(sessionStorage.getItem(TABS_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter(esPestana) : []
  } catch {
    return []
  }
}

// `usuario` ties the stored tabs to whoever is signed in (the portal passes it: PestanasDeLaSesion); without it they
// are anyone's
export function WorkspaceTabsProvider({ usuario, children }: { usuario?: string; children: ReactNode }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => load(usuario))
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs))
      if (usuario !== undefined) sessionStorage.setItem(TABS_USER_KEY, usuario)
    } catch {
      // storage full or blocked: tabs just do not survive a reload
    }
  }, [tabs, usuario])

  const open = useCallback((tab: WorkspaceTab) => {
    setTabs((current) => {
      const index = current.findIndex((t) => t.path === tab.path)
      if (index === -1) return [...current, tab]
      if (current[index].label === tab.label) return current
      return current.map((t, i) => (i === index ? tab : t))
    })
  }, [])

  // closing the tab on screen moves to its right neighbour, else the left one, else home. the tab goes once the move
  // happens: a page with changes not saved may keep the clerk there (useUnsavedChanges), with its tab
  const close = useCallback(
    (path: string) => {
      const index = tabs.findIndex((t) => t.path === path)
      if (index === -1) return
      const rest = tabs.filter((t) => t.path !== path)
      if (location.pathname === path) navigate(rest[index]?.path ?? rest[index - 1]?.path ?? '/', { state: { cerrar: path } })
      else setTabs(rest)
    },
    [tabs, location.pathname, navigate]
  )
  // once per arrival: back on that history entry later, a ficha opened again since stays
  const cerrar = (location.state as { cerrar?: string } | null)?.cerrar
  const cerradas = useRef(new Set<string>())
  useEffect(() => {
    if (!cerrar || cerradas.current.has(location.key)) return
    cerradas.current.add(location.key)
    setTabs((current) => current.filter((t) => t.path !== cerrar))
  }, [cerrar, location.key])

  const value = useMemo(() => ({ tabs, open, close }), [tabs, open, close])
  return <Context value={value}>{children}</Context>
}

// the portal's workspace tabs, the signed-in clerk's own (keyed: another clerk starts with none)
export function PestanasDeLaSesion({ children }: { children: ReactNode }) {
  const { user } = useSession()
  return (
    <WorkspaceTabsProvider key={user?.id} usuario={user?.id}>
      {children}
    </WorkspaceTabsProvider>
  )
}

export function useWorkspaceTabs(): WorkspaceTabs {
  const context = use(Context)
  if (!context) throw new Error('useWorkspaceTabs must be used inside WorkspaceTabsProvider')
  return context
}

// a ficha registers itself once its label is known
export function useWorkspaceTab(tab: WorkspaceTab | null) {
  const { open } = useWorkspaceTabs()
  const path = tab?.path
  const label = tab?.label
  const kind = tab?.kind
  useEffect(() => {
    if (path && label && kind) open({ path, label, kind })
  }, [open, path, label, kind])
}
