import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card, cn } from '@wasichai/ui'
import { ArrowRight, FileText, MapPin, Save, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { currentYear, today } from '../components/format'
import { DJ_DATOS_SECTIONS, UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { describePredio } from '../forms/DeclaracionDialog'
import { RecordForm } from '../forms/RecordForm'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import { emptyOf } from '../forms/specs'
import { useCatalogos, useRefresh } from '../queries'
import type { Declaracion, Predio } from '../types'
import { DECLARACION_TABS } from './DeclaracionPage'

const DATOS_FORM = 'dj-datos'
const UBICACION_FORM = 'dj-ubicacion'

// the padrón's district, in the selva: where a new predio most likely is
const PERENE = { ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE', region: 'SELVA' }

export function NuevaDeclaracionRoute() {
  const { id = '' } = useParams()
  return <NuevaDeclaracionPage key={id} contribuyente={id} />
}

// the srtm's "declaración jurada y registro de predio" for a contribuyente: step one the datos del predio, step two
// the ubicación, of a predio already in the padrón or of one registered here. saving presents it and opens it
function NuevaDeclaracionPage({ contribuyente }: { contribuyente: string }) {
  const navigate = useNavigate()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const ficha = useQuery({
    queryKey: ['contribuyente', contribuyente, currentYear()],
    queryFn: () => rentas.contribuyente(contribuyente, currentYear()),
    placeholderData: keepPreviousData
  })
  const [tab, setTab] = useState<'datos' | 'ubicacion'>('datos')
  const [datos, setDatos] = useState<Declaracion | null>(null)
  const [modo, setModo] = useState<'nuevo' | 'existente'>('nuevo')
  const [existente, setExistente] = useState<Picked | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const presentar = async (predio: { predio?: Predio; predio_id?: string }) => {
    if (!datos) return
    const dj = await rentas.presentarDeclaracion(contribuyente, { declaracion: datos, ...predio })
    await refresh()
    navigate(`/declaraciones/${dj.declaracion.id}?tab=transferentes`, { replace: true })
  }
  const presentarExistente = async () => {
    if (!existente) {
      setError('Busca y elige el predio de la declaración')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await presentar({ predio_id: existente.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const c = ficha.data?.contribuyente
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {c ? `${c.codigo ? `Contribuyente Nº ${c.codigo}` : 'Contribuyente'} - ${c.nombre_completo ?? ''}` : 'Contribuyente'}
          </p>
          <h1 className="text-xl font-semibold text-ink uppercase">Nueva declaración jurada predial</h1>
          <p className="text-xs font-semibold tracking-wide text-brand uppercase italic">Declaración jurada y registro de predio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <X className="size-4" />
            Cancelar
          </Button>
          {tab === 'datos' ? (
            <Button type="submit" form={DATOS_FORM}>
              <ArrowRight className="size-4" />
              Siguiente
            </Button>
          ) : modo === 'nuevo' ? (
            <Button type="submit" form={UBICACION_FORM}>
              <Save className="size-4" />
              Guardar
            </Button>
          ) : (
            <Button onClick={() => void presentarExistente()} disabled={busy}>
              <Save className="size-4" />
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
        </div>
      </div>
      <Card className="pb-5">
        <FichaTabs
          label="Declaración jurada predial"
          active={tab}
          onChange={(next) => setTab(next === 'ubicacion' && datos ? 'ubicacion' : 'datos')}
          tabs={DECLARACION_TABS.map((t) => ({
            ...t,
            icon: t.id === 'ubicacion' ? MapPin : FileText,
            disabled: t.id === 'ubicacion' ? !datos : t.id !== 'datos',
            render: () =>
              t.id === 'datos' ? (
                <div className="px-6 pt-5">
                  <RecordForm
                    formId={DATOS_FORM}
                    hideActions
                    sections={DJ_DATOS_SECTIONS}
                    options={catalogos.data?.declaracion_predial}
                    initial={emptyOf<Declaracion>(DJ_DATOS_SECTIONS, {
                      motivo: 'INSCRIPCION',
                      medio_determinacion: 'DECLARACION JURADA',
                      medio_presentacion: 'FISICO',
                      fecha_presentacion: today(),
                      anio: currentYear(),
                      secuencia_uso: '1',
                      condicion_propiedad: 'PROPIETARIO UNICO',
                      porcentaje_condominio: 100
                    })}
                    submitLabel="Siguiente"
                    onSubmit={async (values) => {
                      setDatos(values)
                      setTab('ubicacion')
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-5 px-6 pt-5">
                  <div role="radiogroup" aria-label="Predio de la declaración" className="flex flex-wrap gap-2">
                    {(
                      [
                        ['nuevo', 'Registrar un predio nuevo'],
                        ['existente', 'Buscar un predio del padrón']
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={modo === value}
                        onClick={() => {
                          setModo(value)
                          setError(null)
                        }}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm',
                          modo === value ? 'border-brand bg-brand-soft font-medium text-brand-strong' : 'border-border text-ink-muted hover:text-ink'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {modo === 'existente' ? (
                    <div className="max-w-2xl space-y-3">
                      <RecordPicker
                        label="Predio"
                        placeholder="Código, dirección o habilitación urbana"
                        value={existente}
                        onChange={(p) => {
                          setExistente(p)
                          setError(null)
                        }}
                        search={(q) => rentas.predios(q, 0, 8)}
                        describe={describePredio}
                        error={error ?? undefined}
                      />
                      {error && existente && (
                        <p role="alert" className="text-sm text-danger">
                          {error}
                        </p>
                      )}
                    </div>
                  ) : (
                    <RecordForm
                      formId={UBICACION_FORM}
                      hideActions
                      sections={UBICACION_SECTIONS}
                      options={catalogos.data?.predio}
                      initial={emptyOf<Predio>(UBICACION_SECTIONS, { ...PERENE, condicion: 'URBANO' })}
                      submitLabel="Guardar"
                      onSubmit={(predio) => presentar({ predio })}
                    />
                  )}
                </div>
              )
          }))}
        />
      </Card>
    </div>
  )
}
