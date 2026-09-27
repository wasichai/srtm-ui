import { useQuery } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import { NativeSelect } from '../components/controles'
import { currentYear } from '../components/format'
import { COLUMNAS_CATEGORIA } from '../types'
import type { FormValues } from './specs'

// the srtm's "datos de la categoría": one row per column of the official unit-value table, its letter (A-I) and,
// beside it, what that letter means. the letters offered are the ones the table describes for that column
export const COLUMNAS = [
  { field: 'muros_columnas', label: 'Muros y columnas', required: true },
  { field: 'techos', label: 'Techos', required: true },
  { field: 'pisos', label: 'Pisos', required: false, enabledWhen: deOtroAnio },
  { field: 'puertas_ventanas', label: 'Puertas y ventanas', required: true },
  { field: 'revestimientos', label: 'Revestimientos', required: false, enabledWhen: deOtroAnio },
  { field: 'banos', label: 'Baños', required: false, enabledWhen: deOtroAnio },
  // eléctricas y sanitarias, as the srtm writes it (page 16)
  { field: 'instalaciones', label: 'Instalaciones de E/S', required: false, enabledWhen: deOtroAnio }
] satisfies { field: (typeof COLUMNAS_CATEGORIA)[number]; label: string; required: boolean; enabledWhen?: (values: FormValues) => boolean }[]

// the srtm's manual (M01-1-014, niveles de construcción): pisos, revestimiento, baños and instalaciones "no son
// modificables" for a construction of this year, greyed as on page 16
function deOtroAnio(values: FormValues): boolean {
  return values.anio_construccion !== String(currentYear())
}

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
        const enabled = columna.enabledWhen?.(values) ?? true
        const value = enabled ? (values[columna.field] ?? '') : ''
        const id = `field-${columna.field}`
        const error = form.formState.errors[columna.field]?.message
        const descripcion = letras.find((c) => c.letra === value)?.descripcion ?? ''
        return (
          <div key={columna.field} className="grid grid-cols-[minmax(0,12rem)_6rem_minmax(0,1fr)] items-start gap-x-4">
            <label htmlFor={id} className="pt-2 text-sm text-ink">
              {columna.label}
              {columna.required && enabled && <span className="text-danger"> *</span>}
            </label>
            <div>
              <NativeSelect
                id={id}
                value={value}
                disabled={!enabled}
                onChange={(e) => form.setValue(columna.field, e.target.value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : `${id}-descripcion`}
              >
                <option value="">—</option>
                {(letras.length > 0 ? letras.map((c) => c.letra) : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']).map((letra) => (
                  <option key={letra} value={letra}>
                    {letra}
                  </option>
                ))}
              </NativeSelect>
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
