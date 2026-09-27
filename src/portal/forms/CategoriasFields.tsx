import { useQuery } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import { COLUMNAS_CATEGORIA } from '../types'
import type { FormValues } from './specs'
import { selectClass } from './styles'

// the srtm's "datos de la categoría": one row per column of the official unit-value table, its letter (A-I) and,
// beside it, what that letter means. the letters offered are the ones the table describes for that column
export const COLUMNAS = [
  { field: 'muros_columnas', label: 'Muros y columnas', required: true },
  { field: 'techos', label: 'Techos', required: true },
  { field: 'pisos', label: 'Pisos', required: false },
  { field: 'puertas_ventanas', label: 'Puertas y ventanas', required: true },
  { field: 'revestimientos', label: 'Revestimientos', required: false },
  { field: 'banos', label: 'Baños', required: false },
  { field: 'instalaciones', label: 'Instalaciones eléctricas y sanitarias', required: false }
] satisfies { field: (typeof COLUMNAS_CATEGORIA)[number]; label: string; required: boolean }[]

export function useCategoriasValor() {
  return useQuery({ queryKey: ['categorias-valor'], queryFn: rentas.categoriasValor, staleTime: Infinity })
}

export function CategoriasFields({ form }: { form: UseFormReturn<FormValues> }) {
  const categorias = useCategoriasValor().data ?? []
  const values = form.watch()
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,12rem)_6rem_minmax(0,1fr)] gap-x-4 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        <span>Categoría</span>
        <span>Letra</span>
        <span>Descripción</span>
      </div>
      {COLUMNAS.map((columna, index) => {
        const letras = categorias.filter((c) => c.columna === index + 1)
        const value = values[columna.field] ?? ''
        const id = `field-${columna.field}`
        const error = form.formState.errors[columna.field]?.message
        const descripcion = letras.find((c) => c.letra === value)?.descripcion ?? ''
        return (
          <div key={columna.field} className="grid grid-cols-[minmax(0,12rem)_6rem_minmax(0,1fr)] items-start gap-x-4">
            <label htmlFor={id} className="pt-2 text-sm text-ink">
              {columna.label}
              {columna.required && <span className="text-danger"> *</span>}
            </label>
            <div>
              <select
                id={id}
                value={value}
                onChange={(e) => form.setValue(columna.field, e.target.value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : `${id}-descripcion`}
                className={selectClass}
              >
                <option value="">—</option>
                {(letras.length > 0 ? letras.map((c) => c.letra) : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']).map((letra) => (
                  <option key={letra} value={letra}>
                    {letra}
                  </option>
                ))}
              </select>
              {error && (
                <p id={`${id}-error`} className="mt-1 text-xs text-danger">
                  {error}
                </p>
              )}
            </div>
            <p id={`${id}-descripcion`} className="min-h-9 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-ink-muted">
              {descripcion}
            </p>
          </div>
        )
      })}
    </div>
  )
}
