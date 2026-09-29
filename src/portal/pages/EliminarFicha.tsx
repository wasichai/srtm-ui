import { Button, ConfirmDialog } from '@wasichai/ui'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage } from '../../kit/ui/errorMessage'
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
      setError(errorMessage(e, 'No se pudo eliminar'))
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
        <ConfirmDialog
          title={`¿Eliminar este ${singular}?`}
          description="Solo se puede eliminar si no tiene declaraciones juradas, vigentes ni anuladas. No se puede deshacer."
          busy={busy}
          error={error}
          onConfirm={() => void eliminar()}
          onCancel={cerrar}
        />
      )}
    </>
  )
}
