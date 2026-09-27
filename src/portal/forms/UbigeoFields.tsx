import { useQuery } from '@tanstack/react-query'
import { Label } from '@wasichai/ui'
import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import { NativeSelect } from '../components/controles'
import type { Ubigeo } from '../types'
import { bloqueadosEn } from './bloqueo'
import { useCampoId } from './campoId'
import type { FormValues } from './specs'

const distinct = (values: string[]) => [...new Set(values)]

// departamento -> provincia -> distrito over the INEI list, writing the form's four hidden fields
// (departamento, provincia, distrito and the ubigeo code). changing one level clears the ones under it. a level a lote
// of the catastro filled is greyed (forms/bloqueo.ts)
export function UbigeoFields({ form }: { form: UseFormReturn<FormValues> }) {
  const ubigeos = useQuery({ queryKey: ['ubigeos'], queryFn: rentas.ubigeos, staleTime: Infinity })
  const [departamento = '', provincia = '', distrito = ''] = form.watch(['departamento', 'provincia', 'distrito'])
  const bloqueados = bloqueadosEn(form)
  const campoId = useCampoId()
  const all: Ubigeo[] = ubigeos.data ?? []
  const departamentos = distinct(all.map((u) => u.departamento))
  const provincias = distinct(all.filter((u) => u.departamento === departamento).map((u) => u.provincia))
  const distritos = all.filter((u) => u.departamento === departamento && u.provincia === provincia)

  const set = (name: string, value: string) => form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  const levels = [
    {
      name: 'departamento',
      label: 'Departamento',
      value: departamento,
      options: departamentos.map((d) => ({ value: d, label: d })),
      change: (value: string) => {
        set('departamento', value)
        set('provincia', '')
        set('distrito', '')
        set('ubigeo', '')
      }
    },
    {
      name: 'provincia',
      label: 'Provincia',
      value: provincia,
      options: provincias.map((p) => ({ value: p, label: p })),
      change: (value: string) => {
        set('provincia', value)
        set('distrito', '')
        set('ubigeo', '')
      }
    },
    {
      name: 'distrito',
      label: 'Distrito',
      value: distrito,
      options: distritos.map((d) => ({ value: d.distrito, label: d.distrito })),
      change: (value: string) => {
        set('distrito', value)
        set('ubigeo', distritos.find((d) => d.distrito === value)?.codigo ?? '')
      }
    }
  ]

  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
      {levels.map((level) => {
        const id = campoId(level.name)
        const error = form.formState.errors[level.name]?.message
        // an address saved before the list was loaded (or outside it) still shows what it says
        const options =
          level.value && !level.options.some((o) => o.value === level.value) ? [{ value: level.value, label: level.value }, ...level.options] : level.options
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
              disabled={ubigeos.isPending || bloqueados.includes(level.name)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            >
              <option value="">{ubigeos.isPending ? 'Cargando…' : 'SELECCIONAR'}</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
