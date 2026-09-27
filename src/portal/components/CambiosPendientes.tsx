import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router'
import { Button } from './controles'

// what a page has not saved yet, by the names the clerk knows it by (its tabs): leaving the page, its workspace tab
// or the browser tab asks first. moving inside the page (another of its tabs: only the url's search) does not.
// `permitir` lets the page's own next navigation through (the wizard, once it has presented the declaration)
export function useSalidaConCambios(pendientes: string[]) {
  const hay = pendientes.length > 0
  const permitido = useRef(false)
  const bloquear = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => hay && !permitido.current && currentLocation.pathname !== nextLocation.pathname,
    [hay]
  )
  const blocker = useBlocker(bloquear)

  // closing or reloading the browser tab: the browser's own question, the only one it allows
  useEffect(() => {
    if (!hay) return
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hay])

  const dialogo =
    blocker.state === 'blocked' ? (
      <ConfirmarDescarte
        titulo="¿Salir sin guardar?"
        pendientes={pendientes}
        consecuencia="Si sales, se pierden."
        confirmar="Salir sin guardar"
        onConfirmar={() => blocker.proceed()}
        onSeguir={() => blocker.reset()}
      />
    ) : null
  const permitir = useCallback(() => {
    permitido.current = true
  }, [])
  return { dialogo, permitir }
}

// "are these changes to be lost?": leaving with them, or Cancelar
export function ConfirmarDescarte({
  titulo,
  pendientes,
  consecuencia,
  confirmar,
  onConfirmar,
  onSeguir
}: {
  titulo: string
  pendientes: string[]
  consecuencia: string
  confirmar: string
  onConfirmar: () => void
  onSeguir: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onSeguir()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-ink-muted">
          Hay cambios sin guardar en {pendientes.join(', ')}. {consecuencia}
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onSeguir}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={onConfirmar}>
            {confirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
