import { PdfDialog as PdfDialogBase } from '@wasichai/ui'
import { errorMessage } from '../../kit/ui/errorMessage'
import { rentas, RentasError } from '../api'

export interface PdfDialogProps {
  // under /api: '/srtm/predios/p1/pu?anio=2026'
  path: string
  // the dialog's and the embedded PDF's name: 'PU — 01-01-0001 — 2026'
  titulo: string
  onClose: () => void
  // who opened it may take an error on (the PU's 409 lists the titulares to pick from); it is shown all the same
  onError?: (error: RentasError) => void
}

const comoError = (e: unknown) => (e instanceof RentasError ? e : new RentasError(0, errorMessage(e, 'No se pudo generar el documento')))

// a PDF of srtm-backend (the PU, the HR) embedded to see, print or download it (wasichai/srtm-ui#61): the library's
// dialog, fetched with the session's token (rentas.blob), and srtm-backend's errors as the portal writes them: the
// detail and, on a 422, the parámetros that are missing
export function PdfDialog({ path, titulo, onClose, onError }: PdfDialogProps) {
  return (
    <PdfDialogBase
      title={titulo}
      source={path}
      load={(p) => rentas.blob(p)}
      onClose={onClose}
      onError={(e) => onError?.(comoError(e))}
      renderError={(e) => {
        const error = comoError(e)
        return (
          <>
            <p className="font-semibold">{error.message}</p>
            {error.faltan.length > 0 && <p>Faltan parámetros: {error.faltan.join(', ')}</p>}
          </>
        )
      }}
    />
  )
}
