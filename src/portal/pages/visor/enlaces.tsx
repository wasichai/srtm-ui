import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, type ComponentProps, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { rutaFicha, tituloDeFicha, type FichaConTitulo } from '../../shell/fichas'
import { useWorkspaceTabsOpcional } from '../../shell/WorkspaceTabs'

// how the visor's links to a ficha (a predio, a contribuyente, a DJ) open (wasichai/srtm-ui#164). in the visor, the
// ficha's workspace tab opens in the background: the clerk stays on the map and the rows, and the tab lights up for
// a moment. on the full page, which has no workspace, in a new tab of the browser, so the map stays as it was left:
// its route says so for all of them, popup included. they are real links either way: ctrl or cmd and the middle
// button open a tab of the browser, as anywhere
const EnlacesExternos = createContext(false)

export const ConEnlacesExternos = EnlacesExternos.Provider

export interface EnlaceFichaProps extends Omit<ComponentProps<typeof Link>, 'to'> {
  ficha: FichaConTitulo
  id: string
  // the tab's title until the ficha's own is read: what the link already knows of it
  titulo: string
}

const otroDestino = (e: MouseEvent) => e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

export function EnlaceFicha({ ficha, id, titulo, onClick, ...props }: EnlaceFichaProps) {
  const externos = useContext(EnlacesExternos)
  const pestanas = useWorkspaceTabsOpcional()
  const qc = useQueryClient()
  const path = rutaFicha(ficha, id)
  const to = rutaFicha(ficha, encodeURIComponent(id))
  if (externos) return <Link {...props} to={to} onClick={onClick} target="_blank" rel="noopener noreferrer" />
  return (
    <Link
      {...props}
      to={to}
      onClick={(e) => {
        onClick?.(e)
        if (!pestanas || otroDestino(e)) return
        e.preventDefault()
        pestanas.openInBackground({ path, label: titulo, kind: ficha }, tituloDeFicha(qc, ficha, id))
      }}
    />
  )
}
