import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, PenLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@wasichai/ui'
import { lockedIn } from '../../kit/forms/locked'
import type { FormValues } from '../../kit/forms/spec'
import { rentas } from '../api'
import { parseGeometry, recordIdOf, type Bbox, type Feature, type FeatureCollection, type Geometry } from '../components/geo'
import { LotesMap } from '../components/LotesMap'

const PROPIO = 'lote-del-predio'

// the srtm's "predio de catastro fiscal" map (page 14): the predio's lote, highlighted, over the catastro's lotes
// around it. a catastro lote clicked is taken as the predio's (its CPU and its polygon); "dibujar lote" draws or edits
// the polygon by hand. it writes the form's codigo_cpu and lote_geom. a lote taken with "buscar predios" is the
// catastro's: shown, not redrawn, until "desbloquear". the lote editor (tomar false) draws a lote of the catastro
// itself: the others are only shown around it
export function CatastroMapa({
  form,
  tomar = true,
  label = 'Mapa del predio de catastro fiscal'
}: {
  form: UseFormReturn<FormValues>
  tomar?: boolean
  label?: string
}) {
  const [bbox, setBbox] = useState<Bbox | null>(null)
  const [dibujando, setDibujando] = useState(false)
  const lote = parseGeometry(form.watch('lote_geom'))
  const fijo = lockedIn(form).includes('lote_geom')
  const vecinos = useQuery({
    queryKey: ['lotes', 'catastro', bbox],
    queryFn: () => rentas.lotes('catastro_fiscal', bbox!),
    enabled: bbox !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
  const features = useMemo<FeatureCollection>(() => {
    const list: Feature[] = (vecinos.data?.features ?? []).filter((f) => f.properties.codigo_cpu !== form.getValues('codigo_cpu'))
    if (lote) list.push({ type: 'Feature', geometry: lote, properties: { __id: PROPIO } })
    return { type: 'FeatureCollection', features: list }
  }, [vecinos.data, lote, form])

  const set = (name: string, value: string) => form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  const tomarLote = (id: string) => {
    const feature = vecinos.data?.features.find((f) => recordIdOf(f) === id)
    if (!feature?.geometry) return
    set('lote_geom', JSON.stringify(feature.geometry))
    if (typeof feature.properties.codigo_cpu === 'string') set('codigo_cpu', feature.properties.codigo_cpu)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {fijo
            ? 'El lote del catastro fiscal está resaltado.'
            : dibujando
              ? 'Dibuja el lote punto por punto y ciérralo en el primero; luego puedes arrastrar sus vértices.'
              : !tomar
                ? lote
                  ? 'El lote está resaltado sobre los demás del catastro.'
                  : 'Dibuja el lote sobre el mapa.'
                : lote
                  ? 'El lote del predio está resaltado. Un lote del catastro con un clic pasa a ser el del predio.'
                  : 'Elige el lote del catastro con un clic, o dibújalo.'}
        </span>
        {!fijo && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setDibujando((d) => !d)}>
            {dibujando ? <Check className="size-4" /> : <PenLine className="size-4" />}
            {dibujando ? 'Terminar' : lote ? 'Editar lote' : 'Dibujar lote'}
          </Button>
        )}
      </div>
      <LotesMap
        className="h-80"
        label={label}
        features={features}
        selectedId={lote ? PROPIO : null}
        onSelect={dibujando || fijo || !tomar ? undefined : (id) => id !== PROPIO && tomarLote(id)}
        onBounds={setBbox}
        draw={dibujando && !fijo ? { value: lote, onChange: (g: Geometry | null) => g && set('lote_geom', JSON.stringify(g)) } : null}
      />
    </div>
  )
}
