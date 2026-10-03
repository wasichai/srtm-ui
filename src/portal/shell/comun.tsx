import { cn } from '@wasichai/ui'
import { Gavel, Home, Landmark, MapPinned, Megaphone, Printer, Search, Users } from 'lucide-react'
import { useState, type ComponentType, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

// what both shells (AppShell's classic one and PortalShell) share

export const ENTIDAD = 'Municipalidad Distrital de Perené'

export const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/contribuyentes', label: 'Contribuyentes', icon: Users, end: false },
  { to: '/predios', label: 'Predios', icon: MapPinned, end: false },
  // its pages link to each other (SubnavArbitrios)
  { to: '/arbitrios', label: 'Arbitrios', icon: Landmark, end: false },
  // its pages link to each other (SubnavInfracciones); the CUIS until the expedientes' page is there
  { to: '/infracciones/cuis', label: 'Infracciones', icon: Gavel, end: false },
  // its pages link to each other (SubnavAnuncios)
  { to: '/anuncios', label: 'Anuncios', icon: Megaphone, end: false },
  { to: '/emisiones', label: 'Emisión masiva', icon: Printer, end: false }
]

// the lateral gets whether it is open (the header's menu button, usePanelLateral) and tells a pick, which may close
// it; a foldable one (the portal's tree) has its own button to fold it
export interface LateralProps {
  abierto: boolean
  onNavegar: () => void
  onPlegar: () => void
}

// what a variant of the shell draws inside AppShell's frame: class names of the frame's own elements (over their
// classic look where the name says so) and its pieces
export interface PiezasShell {
  cabecera: string
  botonMenu: string
  // the lateral folds on any screen, remembered for the browser tab, and the header's menu button shows only while
  // it is folded (the portal's tree). otherwise it is the classic phone menu
  plegable?: boolean
  // the search input and the theme button, over their classic look
  busqueda?: string
  tema?: string
  admin: string
  Marca: ComponentType
  Sesion: ComponentType
  Lateral: ComponentType<LateralProps>
  Pie?: ComponentType
}

// the header search: both padrones at once, on /buscar
export function GlobalSearch({ inputClassName }: { inputClassName?: string }) {
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
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface-muted pr-3 pl-9 text-sm placeholder:text-ink-muted/70 focus:bg-surface',
          inputClassName
        )}
      />
    </form>
  )
}

export function initials(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
