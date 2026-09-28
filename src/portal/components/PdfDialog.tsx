import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { Download, Loader2, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

type Estado = { cargando: true } | { url: string; filename: string } | { error: RentasError }

const comoError = (e: unknown) => (e instanceof RentasError ? e : new RentasError(0, e instanceof Error ? e.message : 'No se pudo generar el documento'))

// a PDF of srtm-backend (the PU, the HR) embedded to see, print or download it (wasichai/srtm-ui#61). its blob url
// lives while the dialog is open: it is revoked on closing, or when it is unmounted
export function PdfDialog({ path, titulo, onClose, onError }: PdfDialogProps) {
  const [estado, setEstado] = useState<Estado>({ cargando: true })
  const iframe = useRef<HTMLIFrameElement>(null)
  const url = useRef<string | null>(null)
  const alFallar = useRef(onError)
  alFallar.current = onError

  const revocar = () => {
    if (url.current) URL.revokeObjectURL(url.current)
    url.current = null
  }

  useEffect(() => {
    let vivo = true
    setEstado({ cargando: true })
    rentas.blob(path).then(
      ({ blob, filename }) => {
        if (!vivo) return
        url.current = URL.createObjectURL(blob)
        setEstado({ url: url.current, filename })
      },
      (e: unknown) => {
        if (!vivo) return
        const error = comoError(e)
        setEstado({ error })
        alFallar.current?.(error)
      }
    )
    return () => {
      vivo = false
      revocar()
    }
  }, [path])

  const cerrar = () => {
    revocar()
    onClose()
  }
  const imprimir = () => {
    const ventana = iframe.current?.contentWindow
    ventana?.focus()
    ventana?.print()
  }

  const listo = 'url' in estado ? estado : null
  const error = 'error' in estado ? estado.error : null

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col">
        <DialogTitle className="pr-10 text-lg font-semibold">{titulo}</DialogTitle>
        <DialogDescription className="sr-only">Vista previa del documento en PDF, para imprimirlo o descargarlo.</DialogDescription>
        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-surface-muted">
          {'cargando' in estado && (
            <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" />
              Generando…
            </div>
          )}
          {listo && <iframe ref={iframe} title={titulo} src={listo.url} className="size-full border-0 bg-white" />}
          {error && (
            <div role="alert" className="space-y-1 p-6 text-sm text-danger">
              <p className="font-semibold">{error.message}</p>
              {error.faltan.length > 0 && <p>Faltan parámetros: {error.faltan.join(', ')}</p>}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={!listo} onClick={imprimir}>
            <Printer className="size-4" />
            Imprimir
          </Button>
          {listo ? (
            <Button asChild variant="secondary">
              <a href={listo.url} download={listo.filename}>
                <Download className="size-4" />
                Descargar
              </a>
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              <Download className="size-4" />
              Descargar
            </Button>
          )}
          <Button onClick={cerrar}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
