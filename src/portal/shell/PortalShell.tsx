import { Landmark } from 'lucide-react'
import { SISTEMA, useEntidad, type PiezasShell } from './comun'
import { MenuSesion } from './MenuSesion'
import { RielPortal } from './RielPortal'

// the shell of the portal-tributario theme (useVarianteTema() === 'portal'), drawn in AppShell's frame: a brand bar in
// the shell colours with the search, the theme menu and the session menu, and the open fichas as its second row; a
// light rail of modules, which never folds; and the institutional footer. the bar, the rail and the footer do not print
export const PortalShell: PiezasShell = {
  // two rows: the bar's 56px (8px, its 40px of controls, and the tabs' 8px above them) and the tabs, which wrap to a
  // row of their own
  cabecera: 'flex shrink-0 flex-wrap items-center gap-x-2 bg-shell px-4 pt-2 text-shell-ink sm:gap-x-4 print:hidden',
  // on a phone the rail spans the row, over the content
  cuerpo: 'max-sm:flex-col',
  pestanasEnCabecera: true,
  // a ficha shows its trail in its title band; a screen without one, none
  rutaEnBanda: true,
  // white on the bar, its text in ink (not the bar's white), the focus ring white: the theme's focus blue is lost
  // on the shell blue
  busqueda: 'border-transparent bg-surface text-ink focus-visible:outline-shell-ink',
  tema: 'text-shell-muted hover:bg-shell-ink/10 hover:text-shell-ink focus-visible:outline-shell-ink',
  Marca,
  // the prototype's bar also shows the contributor's condition and a notices tray (a button with a badge) here,
  // before the session. the staff portal has no data for either, so neither is drawn: no empty button. the
  // administration is in the rail and in the session menu
  Sesion: MenuSesion,
  Lateral: RielPortal,
  Pie
}

// the municipality's shield: the one uploaded to its municipalidad record, else lucide's Landmark
function Escudo({ escudo }: { escudo: string | null }) {
  if (escudo) return <img src={escudo} alt="" aria-hidden className="size-9 shrink-0 object-contain" />
  return <Landmark aria-hidden className="size-9 shrink-0" strokeWidth={1.75} />
}

function Marca() {
  const { nombre, escudo } = useEntidad()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Escudo escudo={escudo} />
      {/* on a phone the search needs the room: the shield alone */}
      <div className="min-w-0 leading-tight max-sm:hidden">
        <p className="truncate text-[17px] font-bold">Rentas municipales</p>
        {nombre && <p className="truncate text-[11.5px] text-shell-muted max-[860px]:hidden">{nombre}</p>}
      </div>
    </div>
  )
}

function Pie() {
  const { nombre } = useEntidad()
  return (
    <footer className="shrink-0 border-t border-line bg-table-stripe px-4 py-2.5 text-center text-[13px] text-ink-muted print:hidden">
      {nombre ? `${nombre} — ${SISTEMA}` : SISTEMA}
    </footer>
  )
}
