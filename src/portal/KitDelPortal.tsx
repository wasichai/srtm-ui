import type { ReactNode } from 'react'
import { KitProvider } from '../kit/KitProvider'
import { Alert } from '@wasichai/ui'
import { etiqueta } from './forms/etiquetas'

// what the kit's forms and fichas take from the portal: how the srtm writes an option (forms/etiquetas.ts), and the
// box a form's error shows in
const alertaDelFormulario = (mensaje: string) => (
  <Alert tone="danger" className="rounded-md bg-danger/10 px-3 py-2">
    {mensaje}
  </Alert>
)

export function KitDelPortal({ children }: { children: ReactNode }) {
  return (
    <KitProvider enumLabel={etiqueta} renderAlert={alertaDelFormulario}>
      {children}
    </KitProvider>
  )
}
