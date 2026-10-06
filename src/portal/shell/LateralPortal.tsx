import { NavTree } from '@wasichai/core'
import { useMemo, useState } from 'react'
import { useSession } from '../auth/session'
import type { LateralProps } from './comun'
import { arbolPara, NAV_TREE } from './navTree'
import { guardarNav, leerNav } from './panelLateral'

// the portal's lateral: the tree of trámites (NAV_TREE, the administration for admins only) in core's NavTree, its
// groups remembered for the browser tab like the panel (usePanelLateral)
export function LateralPortal({ abierto, onNavegar, onPlegar }: LateralProps) {
  const { isAdmin } = useSession()
  const nodos = useMemo(() => arbolPara(NAV_TREE, { isAdmin }), [isAdmin])
  const [grupos, setGrupos] = useState(() => leerNav().grupos ?? {})

  const alternar = (clave: string) => {
    const siguientes = { ...grupos, [clave]: grupos[clave] === false }
    setGrupos(siguientes)
    guardarNav({ grupos: siguientes })
  }

  return (
    <NavTree
      id="sidebar"
      label="Secciones"
      title="Mis trámites"
      nodes={nodos}
      homeTo="/"
      open={abierto}
      groups={grupos}
      onToggleGroup={alternar}
      onNavigate={onNavegar}
      onFold={onPlegar}
    />
  )
}
