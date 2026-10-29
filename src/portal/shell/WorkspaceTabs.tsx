import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { TABS_KEY, TABS_USER_KEY, useSession } from '../auth/session'

// the workspace tabs, like gisxp's: every ficha one opens stays a tab until it is closed, so a clerk
// attending several people keeps them all a click away. kept per browser tab (sessionStorage)

export interface WorkspaceTab {
  path: string
  label: string
  kind: 'contribuyente' | 'predio' | 'declaracion' | 'lote' | 'expediente' | 'visor'
  // the query the tab goes back to: a screen whose state lives in the url (the visor's filters, layers and view)
  // keeps it here as it changes, so coming back through the tab finds it as it was left
  search?: string
}

// where a tab takes the clerk: its path, with the query it was left on
export const destino = (tab: WorkspaceTab) => tab.path + (tab.search ?? '')

// a tab opened in the background, highlighted for a moment: `vez` tells one highlight from the next of the same tab
export interface TabResaltada {
  path: string
  vez: number
}

interface WorkspaceTabs {
  tabs: WorkspaceTab[]
  open: (tab: WorkspaceTab) => void
  close: (path: string) => void
  // opens a tab, or keeps the one there, without leaving the screen (wasichai/srtm-ui#164): it is highlighted for a
  // moment and announced. `label`, when it comes, is the ficha's own title, the one its page gives the tab
  openInBackground: (tab: WorkspaceTab, label?: Promise<string | null>) => void
  resaltada: TabResaltada | null
  // «Se abrió la pestaña de …», for a polite live region
  aviso: string
}

// how long a tab opened in the background stays highlighted: the fade of tabs.css, or a few seconds of a still
// highlight for whoever asks the system for less motion
export const RESALTE_MS = 1800
export const RESALTE_QUIETO_MS = 4000
const menosMovimiento = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const Context = createContext<WorkspaceTabs | null>(null)

const esPestana = (valor: unknown): valor is WorkspaceTab => {
  const t = valor as Partial<WorkspaceTab> | null
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.path === 'string' &&
    typeof t.label === 'string' &&
    typeof t.kind === 'string' &&
    (t.search === undefined || typeof t.search === 'string')
  )
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
      if (current[index].label === tab.label && current[index].search === tab.search) return current
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
      const vecina = rest[index] ?? rest[index - 1]
      if (location.pathname === path) navigate(vecina ? destino(vecina) : '/', { state: { cerrar: path } })
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

  const [resaltada, setResaltada] = useState<TabResaltada | null>(null)
  const [aviso, setAviso] = useState('')
  const vez = useRef(0)
  const pestanas = useRef(tabs)
  pestanas.current = tabs
  useEffect(() => {
    if (!resaltada) return
    const reloj = setTimeout(() => setResaltada(null), menosMovimiento() ? RESALTE_QUIETO_MS : RESALTE_MS)
    return () => clearTimeout(reloj)
  }, [resaltada])
  const openInBackground = useCallback((tab: WorkspaceTab, label?: Promise<string | null>) => {
    const abierta = pestanas.current.find((t) => t.path === tab.path)
    if (!abierta) setTabs((current) => (current.some((t) => t.path === tab.path) ? current : [...current, tab]))
    vez.current += 1
    setResaltada({ path: tab.path, vez: vez.current })
    setAviso(`Se abrió la pestaña de ${(abierta ?? tab).label}`)
    // the ficha's title once it is read, on the tab opened here (one already open keeps its own)
    if (!abierta)
      void label
        ?.then((titulo) => {
          if (titulo) setTabs((current) => current.map((t) => (t.path === tab.path && t.label === tab.label ? { ...t, label: titulo } : t)))
        })
        .catch(() => {})
  }, [])

  const value = useMemo(() => ({ tabs, open, close, openInBackground, resaltada, aviso }), [tabs, open, close, openInBackground, resaltada, aviso])
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

// the tabs where there are any: a screen drawn outside the shell (a component's test) has none
export function useWorkspaceTabsOpcional(): WorkspaceTabs | null {
  return use(Context)
}

// a ficha registers itself once its label is known
export function useWorkspaceTab(tab: WorkspaceTab | null) {
  const { open } = useWorkspaceTabs()
  const path = tab?.path
  const label = tab?.label
  const kind = tab?.kind
  const search = tab?.search
  useEffect(() => {
    if (path && label && kind) open({ path, label, kind, ...(search ? { search } : {}) })
  }, [open, path, label, kind, search])
}
