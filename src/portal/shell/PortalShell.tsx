import { Landmark } from 'lucide-react'
import { ENTIDAD, type PiezasShell } from './comun'
import { MenuPortal } from './MenuPortal'
import { MenuSesion } from './MenuSesion'

// the shell of the portal-tributario theme (useVarianteTema() === 'portal'), drawn in AppShell's frame: a brand bar in
// the shell colours with the search, the theme menu and the session menu; the menu bar of trámites right under it, the
// page taking the whole width; and the institutional footer. no lateral, so no menu button in the bar. the
// administration is not in the brand bar: admins have it at the end of the menu bar and in the session menu. the bars
// and the footer do not print
export const PortalShell: PiezasShell = {
  cabecera: 'flex h-14 shrink-0 items-center gap-2 bg-shell px-4 text-shell-ink sm:gap-4 print:hidden',
  // the search takes the room the administration left. white on the bar, its text in ink (not the bar's white), the
  // focus ring white: the theme's focus blue is lost on the shell blue
  buscador: 'max-w-xl',
  busqueda: 'border-transparent bg-surface text-ink focus-visible:outline-shell-ink',
  tema: 'text-shell-muted hover:bg-shell-ink/10 hover:text-shell-ink focus-visible:outline-shell-ink',
  Marca,
  // the prototype's bar also shows the contributor's condition and a notices tray (a button with a badge) here,
  // before the session. the staff portal has no data for either, so neither is drawn: no empty button
  Sesion: MenuSesion,
  Menu: MenuPortal,
  Pie
}

// the municipality's shield: lucide's Landmark for now. the real shield (an image) goes here and nowhere else
function Escudo() {
  return <Landmark aria-hidden className="size-9 shrink-0" strokeWidth={1.75} />
}

function Marca() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Escudo />
      {/* on a phone the search needs the room: the shield alone */}
      <div className="min-w-0 leading-tight max-sm:hidden">
        <p className="truncate text-[17px] font-bold">Rentas municipales</p>
        <p className="truncate text-[11.5px] text-shell-muted max-[860px]:hidden">{ENTIDAD}</p>
      </div>
    </div>
  )
}

function Pie() {
  return (
    <footer className="shrink-0 border-t border-line bg-table-stripe px-4 py-2.5 text-center text-[13px] text-ink-muted print:hidden">
      {ENTIDAD} — Sistema de Gestión Tributaria Municipal
    </footer>
  )
}
