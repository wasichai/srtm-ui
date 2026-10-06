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
  // its pages link to each other (SubnavInfracciones)
  { to: '/infracciones', label: 'Infracciones', icon: Gavel, end: false },
  // its pages link to each other (SubnavAnuncios)
  { to: '/anuncios', label: 'Anuncios', icon: Megaphone, end: false },
  { to: '/emisiones', label: 'Emisión masiva', icon: Printer, end: false }
]

// the lateral gets whether it is open (the header's menu button, usePanelLateral) and tells a pick, which closes it.
// the portal's rail needs neither: it never folds
export interface LateralProps {
  abierto: boolean
  onNavegar: () => void
}

// what a variant of the shell draws inside AppShell's frame: class names of the frame's own elements (over their
// classic look where the name says so) and its pieces
export interface PiezasShell {
  cabecera: string
  // the phone's menu button for the lateral; none when the lateral is always there (the portal's rail)
  botonMenu?: string
  // the row of the lateral and the content, over its classic look
  cuerpo?: string
  // the workspace tabs as the header's second row (the portal's), not over the content
  pestanasEnCabecera?: boolean
  // the search input and the theme button, over their classic look
  busqueda?: string
  tema?: string
  // the way to the administration in the header; none when the lateral has it (the portal's rail)
  admin?: string
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
