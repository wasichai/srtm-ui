import { useWatch, type UseFormReturn } from 'react-hook-form'
import type { FormValues } from '../../kit/forms/spec'
import { describirUbicacion } from './direccion'

// the ubicación's direccion as the backend will write it, live, below the fields it is made of (as the domicilio's)
export function DireccionPreview({ form }: { form: UseFormReturn<FormValues> }) {
  const values = useWatch({ control: form.control }) as FormValues
  const texto = describirUbicacion(values)
  return (
    <div className="space-y-1.5">
      <p id="direccion-vista" className="text-xs text-ink-muted">
        Vista previa de la dirección
      </p>
      <p role="status" aria-labelledby="direccion-vista" className="min-h-9 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-ink">
        {texto || '—'}
      </p>
      {!values.tipo_via && values.direccion && <p className="text-xs text-ink-muted">Sin tipo de vía se conserva la dirección del padrón.</p>}
    </div>
  )
}
