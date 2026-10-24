import { useQuery } from '@tanstack/react-query'
import { Button, Input, Label } from '@wasichai/ui'
import { Search, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldId } from '../../kit/forms/fieldId'
import type { FormValues } from '../../kit/forms/spec'
import { normativa } from '../api'
import { formatMoney } from '../components/format'
import { clavesNormativa } from '../queries'
import type { Arancel } from '../types'

// the arancel of a DJ by its tramo de vía (srtm-backend#188): a combobox over Normativa's VIGENTE aranceles of the
// año being edited (Datos') writes the form's hidden id_aranc. with one, the arancel is read-only: the DJ's stored
// figure (srtm-backend#195), with a notice when the tramo's VIGENTE one differs (Recalcular takes it); from a backend
// that does not send it yet, the VIGENTE arancel's own figure. «Quitar tramo» empties id_aranc: the DJ's arancel is
// then as it was (manual, or the padrón's), shown as a fact. the backend's 400 on id_aranc (no VIGENTE one for the
// año) goes under it, and a change of año to one where the tramo has none is told before saving. only for who may
// read aranceles

// the DJ as stored: its año, its id_aranc and its arancel (undefined while the backend does not send it)
export interface LoGuardado {
  anio: number | null
  id_aranc: string | null
  arancel?: number | null
}

const describir = (a: Arancel) => [a.cod_via && `vía ${a.cod_via}`, a.cuadra && `cuadra ${a.cuadra}`, a.lado && `lado ${a.lado}`].filter(Boolean).join(' · ')

// a tramo's VIGENTE arancel of the año, by its exact id_aranc (q is a prefix): null when it has none
function useVigente(idAranc: string, anio: number | null) {
  const filtros = { anio: anio ?? undefined, estado: 'VIGENTE' as const, q: idAranc }
  return useQuery({
    queryKey: clavesNormativa.aranceles(filtros, 0),
    queryFn: () => normativa.aranceles(filtros, 0),
    enabled: Boolean(idAranc && anio),
    select: (pagina) => pagina.content.find((a) => a.id_aranc === idAranc) ?? null
  })
}

export function ArancelDelTramo({ form, anio, guardado }: { form: UseFormReturn<FormValues>; anio: number | null; guardado?: LoGuardado }) {
  const campoId = useFieldId()
  const id = campoId('id_aranc')
  const idAranc = form.watch('id_aranc') ?? ''
  const error = form.formState.errors.id_aranc?.message
  // the one picked here, in this año: its figure shows at once, before the backend is asked again
  const [elegido, setElegido] = useState<Arancel | null>(null)
  const delElegido = elegido !== null && elegido.id_aranc === idAranc && elegido.anio === anio
  const vigente = useVigente(delElegido ? '' : idAranc, anio)
  const arancel = delElegido ? elegido : vigente.data
  const leido = delElegido || vigente.isSuccess
  // the stored figure is this tramo's while the tramo is the stored one; a null or absent one is not shown
  const cifraGuardada = guardado?.arancel ?? null
  const delGuardado = cifraGuardada !== null && idAranc === (guardado?.id_aranc ?? '')
  const anioCambiado = guardado !== undefined && anio !== guardado.anio

  const poner = (valor: string) => form.setValue('id_aranc', valor, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  const errorDelCampo = error && (
    <p id={`${id}-error`} className="text-xs text-danger">
      {error}
    </p>
  )

  if (idAranc) {
    const cifra = delGuardado ? cifraGuardada : arancel?.valor_m2
    const valor = cifra !== undefined ? formatMoney(cifra) : ''
    // a DJ without año asks nothing; a failed search says so, not that there is no VIGENTE one
    const sinVigente =
      anio === null
        ? 'la declaración no tiene año'
        : vigente.isError
          ? 'no se pudo leer el arancel del tramo'
          : !arancel && !vigente.isPending
            ? `sin arancel VIGENTE en ${anio}: se conserva el guardado`
            : undefined
    // what the tramo's VIGENTE arancel says of the figure shown: none in a new año is refused on save, so it is told
    // first; none in the stored año keeps the stored figure. another figure: in a new año the save takes it (the
    // backend works the arancel out again when the año changes); in the stored one, every save ends in the backend's recalcular, which takes it too
    const aviso =
      anio === null || !leido
        ? undefined
        : !arancel
          ? anioCambiado
            ? { tono: 'text-warning', texto: `El tramo ${idAranc} no tiene arancel VIGENTE en ${anio}: elija otro tramo o quítelo antes de guardar` }
            : delGuardado
              ? { tono: 'text-ink-muted', texto: `sin arancel VIGENTE en ${anio}: se conserva el guardado (${formatMoney(cifraGuardada)})` }
              : undefined
          : delGuardado && arancel.valor_m2 !== cifraGuardada
            ? anioCambiado
              ? { tono: 'text-warning', texto: `Al guardar se tomará ${formatMoney(arancel.valor_m2)} (arancel vigente del tramo en ${anio})` }
              : { tono: 'text-warning', texto: `El arancel vigente del tramo es ${formatMoney(arancel.valor_m2)}: se tomará al guardar o con Recalcular` }
            : undefined
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="block truncate">
          Arancel (S/ por m²)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            disabled
            value={valor}
            placeholder={sinVigente ?? 'Cargando…'}
            aria-invalid={error ? true : undefined}
            aria-describedby={[error && `${id}-error`, `${id}-hint`, aviso && `${id}-aviso`].filter(Boolean).join(' ')}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setElegido(null)
              poner('')
            }}
          >
            <X className="size-4" />
            Quitar tramo
          </Button>
        </div>
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          del arancel {idAranc}
          {delGuardado ? '' : ': valor vigente del tramo'}
          {arancel && describir(arancel) ? ` (${describir(arancel)})` : ''}
        </p>
        {aviso && (
          <p id={`${id}-aviso`} role="status" className={`text-xs ${aviso.tono}`}>
            {aviso.texto}
          </p>
        )}
        {errorDelCampo}
      </div>
    )
  }

  return (
    <Combobox
      id={id}
      anio={anio}
      error={error}
      onElegir={(a) => {
        setElegido(a)
        poner(a.id_aranc)
      }}
    >
      {cifraGuardada !== null && (
        <p className="text-xs text-ink-muted">
          Arancel de la declaración: <span className="tabular-nums">{formatMoney(cifraGuardada)}</span> por m²
        </p>
      )}
      {errorDelCampo}
    </Combobox>
  )
}

// what is typed before it searches, as RecordPicker
const MINIMO = 2

// search-as-you-type over the VIGENTE aranceles of the año, by id_aranc or vía: the wai-aria combobox with a listbox
function Combobox({
  id,
  anio,
  error,
  onElegir,
  children
}: {
  id: string
  anio: number | null
  error: string | undefined
  onElegir: (arancel: Arancel) => void
  children?: ReactNode
}) {
  const lista = useId()
  const [q, setQ] = useState('')
  const [activa, setActiva] = useState(-1)
  const term = q.trim()
  const filtros = { anio: anio ?? undefined, estado: 'VIGENTE' as const, q: term }
  const resultados = useQuery({
    queryKey: clavesNormativa.aranceles(filtros, 0),
    queryFn: () => normativa.aranceles(filtros, 0),
    enabled: term.length >= MINIMO && anio !== null
  })
  const opciones = resultados.data?.content ?? []
  const abierta = term.length >= MINIMO && anio !== null
  const elegir = (a: Arancel) => {
    onElegir(a)
    setQ('')
    setActiva(-1)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // enter must not send the DJ's form: a pick is a click, or enter on the option marked
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activa >= 0 && opciones[activa]) elegir(opciones[activa])
    } else if (event.key === 'ArrowDown' && opciones.length > 0) {
      event.preventDefault()
      setActiva((i) => (i + 1) % opciones.length)
    } else if (event.key === 'ArrowUp' && opciones.length > 0) {
      event.preventDefault()
      setActiva((i) => (i <= 0 ? opciones.length - 1 : i - 1))
    } else if (event.key === 'Escape') {
      setQ('')
      setActiva(-1)
    }
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="block truncate">
        Tramo de vía (id_aranc)
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={abierta}
          aria-controls={lista}
          aria-autocomplete="list"
          aria-activedescendant={activa >= 0 ? `${lista}-${activa}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error && `${id}-error`, `${id}-hint`].filter(Boolean).join(' ')}
          value={q}
          disabled={anio === null}
          onChange={(e) => {
            setQ(e.target.value)
            setActiva(-1)
          }}
          onKeyDown={onKeyDown}
          placeholder="id_aranc o código de vía"
          className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm aria-[invalid=true]:border-danger"
        />
      </div>
      {abierta && (
        <ul id={lista} role="listbox" aria-label="Aranceles vigentes" className="max-h-48 overflow-y-auto rounded-md border border-border bg-surface text-sm">
          {resultados.isPending && <li className="px-3 py-2 text-ink-muted">Buscando…</li>}
          {resultados.isError && <li className="px-3 py-2 text-danger">No se pudieron buscar los aranceles</li>}
          {resultados.data?.content.length === 0 && <li className="px-3 py-2 text-ink-muted">Ningún arancel vigente en {anio}</li>}
          {opciones.map((a, i) => (
            <li
              key={a.id}
              id={`${lista}-${i}`}
              role="option"
              aria-selected={i === activa}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(a)}
              className={`flex cursor-pointer justify-between gap-3 px-3 py-2 hover:bg-brand-soft ${i === activa ? 'bg-brand-soft' : ''}`}
            >
              <span>
                <span className="font-semibold">{a.id_aranc}</span>
                {describir(a) && <span className="ml-2 text-ink-muted">{describir(a)}</span>}
              </span>
              <span className="tabular-nums">{formatMoney(a.valor_m2)}</span>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-hint`} className="text-xs text-ink-muted">
        {anio === null
          ? 'La declaración no tiene año: no se puede elegir un tramo.'
          : `Sin tramo, el arancel es el de la declaración. Con uno, el del arancel vigente de ${anio}.`}
      </p>
      {children}
    </div>
  )
}
