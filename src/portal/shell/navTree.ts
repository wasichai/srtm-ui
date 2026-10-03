import { Settings, type LucideIcon } from 'lucide-react'
import { matchPath } from 'react-router'

// the tree menu of the portal (portal-tributario theme): what a clerk does, grouped by what it is done on. the home
// page is not a leaf, the panel's header takes there. a tree is groups (with subgroups, optionally) and leaves

export interface HojaNav {
  label: string
  to: string
  // route patterns (react-router's) that draw this leaf's page too: current there, over any other leaf
  tambienEn?: string[]
  // another app (the administration): a plain link, loaded in full, never current
  externa?: boolean
  soloAdmin?: boolean
  // drawn only by a leaf at the root, where a group has its caret
  icono?: LucideIcon
}

export interface GrupoNav {
  label: string
  hijos: NodoNav[]
  soloAdmin?: boolean
}

export type NodoNav = GrupoNav | HojaNav

export const esGrupo = (nodo: NodoNav): nodo is GrupoNav => 'hijos' in nodo

export const NAV_TREE: NodoNav[] = [
  {
    label: 'Contribuyentes',
    hijos: [
      { label: 'Buscar contribuyentes', to: '/contribuyentes' },
      { label: 'Nuevo contribuyente', to: '/contribuyentes/nuevo' }
    ]
  },
  {
    label: 'Predios',
    hijos: [
      { label: 'Buscar predios', to: '/predios' },
      { label: 'Nuevo predio', to: '/predios/nuevo' }
    ]
  },
  // the wizard started from a contribuyente's ficha is the same new declaration, with its declarant chosen
  { label: 'Declaraciones', hijos: [{ label: 'Nueva declaración', to: '/declaraciones/nueva', tambienEn: ['/contribuyentes/:id/declaraciones/nueva'] }] },
  { label: 'Catastro', hijos: [{ label: 'Nuevo lote', to: '/catastro/nuevo' }] },
  // the arbitrios of a year: the cuotas determined and the ordinance they come from (a predio's or a contribuyente's
  // are in its ficha)
  {
    label: 'Arbitrios',
    hijos: [
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
    hijos: [
      { label: 'Expedientes', to: '/infracciones', tambienEn: ['/infracciones/:id'] },
      { label: 'Nueva acta', to: '/infracciones/nueva' },
      { label: 'Notificaciones previas', to: '/infracciones/notificaciones' },
      { label: 'CUIS', to: '/infracciones/cuis' },
      { label: 'Escalas y plazos', to: '/infracciones/plazos' }
    ]
  },
  // the HR and PU of a whole year, in the background
  { label: 'Emisión', hijos: [{ label: 'Emisión masiva', to: '/emisiones' }] },
  { label: 'Administración', to: '/admin', externa: true, soloAdmin: true, icono: Settings }
]

// the tree a user sees: what is for admins only, only for them; a group left empty goes too
export function arbolPara(nodos: NodoNav[], { isAdmin }: { isAdmin: boolean }): NodoNav[] {
  return nodos.flatMap((nodo): NodoNav[] => {
    if (nodo.soloAdmin && !isAdmin) return []
    if (!esGrupo(nodo)) return [nodo]
    const hijos = arbolPara(nodo.hijos, { isAdmin })
    return hijos.length ? [{ ...nodo, hijos }] : []
  })
}

const hojas = (nodos: NodoNav[]): HojaNav[] => nodos.flatMap((nodo) => (esGrupo(nodo) ? hojas(nodo.hijos) : [nodo]))

// the leaf current on a path: the one whose route is the path, else one whose tambienEn matches it, else the one whose
// route is the longest start of it (/contribuyentes/nuevo is Nuevo contribuyente, /contribuyentes/123 Buscar
// contribuyentes). a leaf's own route goes first: /infracciones/:id (an expediente) matches /infracciones/cuis too. a
// page with no leaf of its own (a declaration's ficha, a lote's) has none
export function hojaActiva(nodos: NodoNav[], pathname: string): HojaNav | undefined {
  const propias = hojas(nodos).filter((hoja) => !hoja.externa)
  const propia = propias.find((hoja) => pathname === hoja.to)
  if (propia) return propia
  const porPatron = propias.find((hoja) => hoja.tambienEn?.some((patron) => matchPath(patron, pathname)))
  if (porPatron) return porPatron
  return propias
    .filter((hoja) => pathname === hoja.to || pathname.startsWith(`${hoja.to}/`))
    .reduce<HojaNav | undefined>((mejor, hoja) => (!mejor || hoja.to.length > mejor.to.length ? hoja : mejor), undefined)
}
