import { isNavTreeGroup, type NavTreeGroup, type NavTreeLeaf } from '@wasichai/core'
import { FileText, Gavel, Landmark, LandPlot, MapPinned, Megaphone, Printer, Settings, Users, type LucideIcon } from 'lucide-react'

// the tree menu of the portal (portal-tributario theme): what a clerk does, grouped by what it is done on. the rail
// (RielPortal) draws one item per group and opens its trámites beside it; the home page is not a leaf, the rail's
// Inicio takes there. the tree's shape, its drawing and its current leaf are @wasichai/core's (NavTree); the trámites,
// the rail's icons and who sees them are srtm's

export interface HojaNav extends NavTreeLeaf {
  // for admins only: the administration. no group has it
  soloAdmin?: boolean
}

// core's group, with what the rail draws of it: its icon and, when the label does not fit the rail's 104px, a short
// one. its children are srtm's nodes too, so a subgroup has them as well
export interface GrupoNav extends NavTreeGroup<HojaNav> {
  icon: LucideIcon
  corto?: string
  children: NodoNav[]
}

export type NodoNav = GrupoNav | HojaNav

export const NAV_TREE: NodoNav[] = [
  {
    label: 'Contribuyentes',
    icon: Users,
    children: [
      { label: 'Buscar contribuyentes', to: '/contribuyentes' },
      { label: 'Nuevo contribuyente', to: '/contribuyentes/nuevo' }
    ]
  },
  {
    label: 'Predios',
    icon: MapPinned,
    children: [
      { label: 'Buscar predios', to: '/predios' },
      { label: 'Nuevo predio', to: '/predios/nuevo' }
    ]
  },
  // the wizard started from a contribuyente's ficha is the same new declaration, with its declarant chosen
  {
    label: 'Declaraciones',
    icon: FileText,
    children: [{ label: 'Nueva declaración', to: '/declaraciones/nueva', alsoAt: ['/contribuyentes/:id/declaraciones/nueva'] }]
  },
  { label: 'Catastro', icon: LandPlot, children: [{ label: 'Nuevo lote', to: '/catastro/nuevo' }] },
  // the arbitrios of a year: the cuotas determined and the ordinance they come from (a predio's or a contribuyente's
  // are in its ficha)
  {
    label: 'Arbitrios',
    icon: Landmark,
    children: [
      { label: 'Consulta de cuotas', to: '/arbitrios' },
      { label: 'Tasas del año', to: '/arbitrios/tasas' },
      { label: 'Determinación masiva', to: '/arbitrios/determinaciones' }
    ]
  },
  // the multas administrativas (SPEC §8.2): the expedientes (an acta's ficha is Expedientes'), a new acta, the
  // notificaciones previas with their subsanación, the CUIS in force on a day, with each code's multa at that day's UIT,
  // and Escalas y plazos (the padrones of the vencidas and where the plazos are loaded)
  {
    label: 'Infracciones administrativas',
    corto: 'Infracciones',
    icon: Gavel,
    children: [
      { label: 'Expedientes', to: '/infracciones', alsoAt: ['/infracciones/:id'] },
      { label: 'Nueva acta', to: '/infracciones/nueva' },
      { label: 'Notificaciones previas', to: '/infracciones/notificaciones' },
      { label: 'CUIS', to: '/infracciones/cuis' },
      { label: 'Escalas y plazos', to: '/infracciones/plazos' }
    ]
  },
  // the tasa de anuncios y propaganda (SPEC §8.2): the padrón (an anuncio's ficha, /anuncios/:id, is under it), a new
  // anuncio with its autorización, and the tasas of a year by clase
  {
    label: 'Anuncios y propaganda',
    corto: 'Anuncios',
    icon: Megaphone,
    children: [
      { label: 'Padrón de anuncios', to: '/anuncios' },
      { label: 'Nuevo anuncio', to: '/anuncios/nuevo' },
      { label: 'Tasas de anuncios', to: '/anuncios/tasas' }
    ]
  },
  // the HR and PU of a whole year, in the background
  { label: 'Emisión', icon: Printer, children: [{ label: 'Emisión masiva', to: '/emisiones' }] },
  { label: 'Administración', to: '/admin', external: true, soloAdmin: true, icon: Settings }
]

// the tree a user sees: what is for admins only, only for them; a group left empty goes too
export function arbolPara(nodos: NodoNav[], { isAdmin }: { isAdmin: boolean }): NodoNav[] {
  return nodos.flatMap((nodo): NodoNav[] => {
    if (!isNavTreeGroup(nodo)) return nodo.soloAdmin && !isAdmin ? [] : [nodo]
    const children = arbolPara(nodo.children, { isAdmin })
    return children.length ? [{ ...nodo, children }] : []
  })
}
