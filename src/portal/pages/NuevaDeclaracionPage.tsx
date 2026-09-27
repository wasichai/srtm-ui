import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card } from '@wasichai/ui'
import { ArrowRight, FileText, MapPin, Save, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { currentYear, today } from '../components/format'
import { DATOS_DEL_PREDIO, DJ_DATOS_SECTIONS, ubicacionSections, UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { FieldGrid } from '../forms/FieldGrid'
import { RecordForm } from '../forms/RecordForm'
import type { Elegido } from '../forms/ubicacion'
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
  // a predio of the padrón picked with "buscar predios": the declaration is on it, no new predio is registered
  const [existente, setExistente] = useState<Predio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sections] = useState(() =>
    ubicacionSections((elegido: Elegido) => {
      const predio = elegido.kind === 'predio' ? elegido.predio : elegido.predio
      if (!predio) return false
      setExistente(predio)
      setError(null)
      return true
    })
  )

  const presentar = async (predio: { predio?: Predio; predio_id?: string }) => {
    if (!datos) return
    // datos del predio carries the predio's tipo; the declaration does not keep it
    const declaracion = Object.fromEntries(Object.entries(datos).filter(([k]) => !DATOS_DEL_PREDIO.includes(k))) as Declaracion
    const dj = await rentas.presentarDeclaracion(contribuyente, { declaracion, ...predio })
    await refresh()
    navigate(`/declaraciones/${dj.declaracion.id}?tab=transferentes`, { replace: true })
  }
  const presentarExistente = async () => {
    if (!existente) return
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
  const tipoPredio = (datos as (Declaracion & { condicion?: string | null }) | null)?.condicion ?? 'URBANO'

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
          ) : !existente ? (
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
                    options={{ ...catalogos.data?.declaracion_predial, condicion: catalogos.data?.predio?.condicion ?? [] }}
                    initial={emptyOf<Declaracion & { condicion?: string | null }>(DJ_DATOS_SECTIONS, {
                      condicion: 'URBANO',
                      motivo: 'INSCRIPCION',
                      medio_determinacion: 'DECLARACION JURADA',
                      medio_presentacion: 'FISICO',
                      fecha_presentacion: today(),
                      anio: currentYear(),
                      secuencia_uso: '001',
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
                  {existente ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand/40 bg-brand-soft px-4 py-3 text-sm">
                        <p className="text-brand-strong">
                          La declaración será sobre el predio <strong>{existente.codigo}</strong> del padrón · {existente.direccion}
                        </p>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setExistente(null)}>
                          <Undo2 className="size-4" />
                          Registrar un predio nuevo
                        </Button>
                      </div>
                      <FieldGrid sections={UBICACION_SECTIONS} values={existente} />
                      {error && (
                        <p role="alert" className="text-sm text-danger">
                          {error}
                        </p>
                      )}
                    </div>
                  ) : (
                    <RecordForm
                      formId={UBICACION_FORM}
                      hideActions
                      sections={sections}
                      options={catalogos.data?.predio}
                      initial={emptyOf<Predio>(sections, { ...PERENE, condicion: tipoPredio })}
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
