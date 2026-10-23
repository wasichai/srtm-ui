import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@wasichai/ui'
import { useEffect, useRef, useState } from 'react'
import { cambiaronCuotas, escucharRedeterminaciones, mensajesDeRedeterminacion, type MensajeArbitrios } from './avisoArbitrios'
import { cambioCaja, escucharCaja, mensajesDeCaja } from './avisoCaja'

// how long the cuotas' aviso stays; the error's stays until it is closed
export const DURACION_AVISO = 8000

interface Aviso extends MensajeArbitrios {
  id: number
  testid: 'aviso-arbitrios' | 'aviso-caja'
}

// what a write of a declaración did to its predio's arbitrios (wasichai/srtm-backend#158), over every screen: the
// cuotas redetermined, which fades, and why they could not be, which stays until closed. cuotas that changed make
// every ficha and list of arbitrios read them again. the same stack shows what it did to the ordenes in caja
// (Srtm-Caja, #164), and ordenes that changed make the caja of every contribuyente read them again
export function AvisosDeArbitrios() {
  const queryClient = useQueryClient()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const siguiente = useRef(0)

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const quitar = (id: number) => setAvisos((actuales) => actuales.filter((a) => a.id !== id))
    const mostrar = (mensajes: MensajeArbitrios[], testid: Aviso['testid']) => {
      const nuevos = mensajes.map((m) => ({ ...m, testid, id: siguiente.current++ }))
      if (nuevos.length === 0) return
      setAvisos((actuales) => [...actuales, ...nuevos])
      for (const aviso of nuevos) {
        if (aviso.tono !== 'success') continue
        const timer = setTimeout(() => {
          timers.delete(timer)
          quitar(aviso.id)
        }, DURACION_AVISO)
        timers.add(timer)
      }
    }
    const dejarArbitrios = escucharRedeterminaciones((r) => {
      if (cambiaronCuotas(r)) void queryClient.invalidateQueries({ queryKey: ['arbitrios'] })
      mostrar(mensajesDeRedeterminacion(r), 'aviso-arbitrios')
    })
    const dejarCaja = escucharCaja((r) => {
      if (cambioCaja(r)) void queryClient.invalidateQueries({ queryKey: ['caja'] })
      // a month caja collected reads as paid in the matriz
      if (r.pagadas_en_caja > 0) void queryClient.invalidateQueries({ queryKey: ['arbitrios'] })
      mostrar(mensajesDeCaja(r), 'aviso-caja')
    })
    return () => {
      dejarArbitrios()
      dejarCaja()
      for (const timer of timers) clearTimeout(timer)
    }
  }, [queryClient])

  if (avisos.length === 0) return null
  return (
    <div aria-label="Avisos" className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2 print:hidden">
      {avisos.map((aviso) => (
        <div key={aviso.id} data-testid={aviso.testid} className="rounded-md border border-border bg-surface px-3 py-2 shadow-lg">
          <Alert tone={aviso.tono} onDismiss={() => setAvisos((actuales) => actuales.filter((a) => a.id !== aviso.id))}>
            {aviso.texto}
          </Alert>
        </div>
      ))}
    </div>
  )
}
