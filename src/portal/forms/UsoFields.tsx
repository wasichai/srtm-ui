import { useQuery } from '@tanstack/react-query'
import { Label } from '@wasichai/ui'
import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import { NativeSelect } from '../components/controles'
import type { UsoPredio } from '../types'
import { useCampoId } from './campoId'
import type { FormValues } from './specs'

const distinct = (values: string[]) => [...new Set(values)]

// the srtm's clase de uso -> sub clase de uso -> uso del predio (pages 17 and 20), over its catalog of usos, writing
// the form's three hidden fields, all three required. changing one level clears the ones under it; a stored value the
// catalog does not offer still shows
export function UsoFields({ form }: { form: UseFormReturn<FormValues> }) {
  const catalogo = useQuery({ queryKey: ['usos-predio'], queryFn: rentas.usosPredio, staleTime: Infinity })
  const [clase = '', subClase = '', uso = ''] = form.watch(['clase_uso', 'sub_clase_uso', 'uso'])
  const campoId = useCampoId()
  const all: UsoPredio[] = catalogo.data ?? []
  const deClase = all.filter((u) => u.clase === clase)

  const set = (name: string, value: string) => form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  const levels = [
    {
      name: 'clase_uso',
      label: 'Clase de uso',
      value: clase,
      options: distinct(all.map((u) => u.clase)),
      change: (value: string) => {
        set('clase_uso', value)
        set('sub_clase_uso', '')
        set('uso', '')
      }
    },
    {
      name: 'sub_clase_uso',
      label: 'Sub clase de uso',
      value: subClase,
      options: distinct(deClase.map((u) => u.sub_clase)),
      change: (value: string) => {
        set('sub_clase_uso', value)
        set('uso', '')
      }
    },
    {
      name: 'uso',
      label: 'Uso del predio',
      value: uso,
      options: distinct(deClase.filter((u) => u.sub_clase === subClase).map((u) => u.uso)),
      change: (value: string) => set('uso', value)
    }
  ]

  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
      {levels.map((level) => {
        const id = campoId(level.name)
        const error = form.formState.errors[level.name]?.message
        const options = level.value && !level.options.includes(level.value) ? [level.value, ...level.options] : level.options
        return (
          <div key={level.name} className="space-y-1.5">
            <Label htmlFor={id} className="block truncate">
              {level.label}
              <span className="text-danger"> *</span>
            </Label>
            <NativeSelect
              id={id}
              value={level.value}
              onChange={(e) => level.change(e.target.value)}
              disabled={catalogo.isPending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            >
              <option value="">{catalogo.isPending ? 'Cargando…' : 'SELECCIONAR'}</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </NativeSelect>
            {error && (
              <p id={`${id}-error`} className="text-xs text-danger">
                {error}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
