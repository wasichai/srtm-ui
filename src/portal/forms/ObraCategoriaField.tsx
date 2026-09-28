import { useQuery } from '@tanstack/react-query'
import { Label, Textarea } from '@wasichai/ui'
import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { rentas } from '../api'
import { NativeSelect } from '../components/controles'
import { bloquear, desbloquear } from './bloqueo'
import type { FormValues } from './specs'

export const etiquetaObra = (c: { numero: number; descripcion: string }) => `${c.numero}. ${c.descripcion}`

// the srtm's "categoría" of an obra complementaria (pages 18-19): a partida of the instructivo for the tipo de obra
// chosen, which also sets the unidad de medida: greyed then (bloqueo.ts), as on page 19. while the catalog
// (model/data/obras_complementarias.csv) is not loaded, or has nothing for that tipo, the categoría is written by hand
// and so is its unidad
export function ObraCategoriaField({ form }: { form: UseFormReturn<FormValues> }) {
  const catalogo = useQuery({ queryKey: ['obras-categorias'], queryFn: rentas.obrasCategorias, staleTime: Infinity })
  const [tipo = '', categoria = ''] = form.watch(['tipo_obra', 'categoria'])
  const opciones = (catalogo.data ?? []).filter((c) => c.tipo_obra === tipo)
  const delCatalogo = opciones.some((c) => etiquetaObra(c) === categoria)
  useEffect(() => {
    bloquear(form, delCatalogo ? ['unidad_medida'] : [])
    // con valorización has no categoría
    return () => desbloquear(form)
  }, [form, delCatalogo])
  const error = form.formState.errors.categoria?.message
  const set = (name: string, value: string) => form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  const common = {
    id: 'field-categoria',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? 'field-categoria-error' : undefined
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="field-categoria" className="block truncate">
        Categoría<span className="text-danger"> *</span>
      </Label>
      {opciones.length > 0 ? (
        <NativeSelect
          {...common}
          value={categoria}
          onChange={(e) => {
            const elegida = opciones.find((c) => etiquetaObra(c) === e.target.value)
            set('categoria', e.target.value)
            if (elegida) set('unidad_medida', elegida.unidad_medida)
          }}
        >
          <option value="">SELECCIONAR</option>
          {categoria && !opciones.some((c) => etiquetaObra(c) === categoria) && <option value={categoria}>{categoria}</option>}
          {opciones.map((c) => (
            <option key={c.numero} value={etiquetaObra(c)}>
              {etiquetaObra(c)}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Textarea
          {...common}
          rows={2}
          value={categoria}
          onChange={(e) => set('categoria', e.target.value)}
          placeholder="LA PARTIDA DEL INSTRUCTIVO DE OBRAS COMPLEMENTARIAS"
        />
      )}
      {error && (
        <p id="field-categoria-error" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
