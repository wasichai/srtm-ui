import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/controles'
import { useWorkspaceTabs } from '../shell/WorkspaceTabs'

// deleting a contribuyente or predio from its ficha (srtm-backend#7): confirmed first. the backend refuses, and says
// why, while it has declaraciones (vigentes or annulled); once it is gone, its workspace tab closes
export function EliminarFicha({ path, singular, borrar }: { path: string; singular: string; borrar: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { tabs, close } = useWorkspaceTabs()
  const navigate = useNavigate()

  const cerrar = () => {
    setOpen(false)
    setError(null)
  }
  const eliminar = async () => {
    setError(null)
    setBusy(true)
    try {
      await borrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
      setBusy(false)
      return
    }
    // the lists and counts that showed it read again when they are opened (nothing keeps them fresh for long)
    if (tabs.some((t) => t.path === path)) close(path)
    else navigate('/')
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 text-danger" />
        Eliminar
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && cerrar()}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-lg font-semibold">¿Eliminar este {singular}?</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-ink-muted">
              Solo se puede eliminar si no tiene declaraciones juradas, vigentes ni anuladas. No se puede deshacer.
            </DialogDescription>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={cerrar}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void eliminar()}>
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
