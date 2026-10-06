import { useQuery } from '@tanstack/react-query'
import { QueryState } from '@wasichai/core'
import { Alert, Badge, Button, Card } from '@wasichai/ui'
import { ArrowRight, Building2, Check, FileText, MapPin, Save, Signpost, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FieldGrid } from '../../kit/forms/FieldGrid'
import { useFormGroup, useSharedFields } from '../../kit/forms/group'
import { RecordForm } from '../../kit/forms/RecordForm'
import { dataFields, type FieldSpec, type FormValues, type SectionSpec } from '../../kit/forms/spec'
import { errorMessage } from '../../kit/ui/errorMessage'
import { ConfirmDiscard, useUnsavedChanges } from '../../kit/ui/UnsavedChanges'
import { rentas } from '../api'
import { anulada, EstadoBadge } from '../components/EstadoBadge'
import { FichaTabs } from '../components/FichaTabs'
import { PasosAsistente } from '../components/PasosAsistente'
import { caracteristicasSections, DATOS_DEL_PREDIO, DJ_DATOS_SECTIONS, opcionesDatos, ubicacionSections } from '../forms/declaracionSpecs'
import { INSTRUCCIONES_DECLARACION } from '../forms/instrucciones'
import { basesDeArbitrio, dimensionesDeArbitrio, useCatalogos, useParametrosArbitrio, useRefresh } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import type { Declaracion } from '../types'
import { AnularDeclaracion, AvisoAnulada } from './AnularDeclaracion'
import { CondominosPanel } from './Condominos'
import { FichaHeader } from './FichaHeader'
import { FrentesPanel, NivelesPanel, ObrasPanel, TransferentesPanel } from './DeclaracionListas'

// the srtm's tabs of a declaración jurada predial
export const DECLARACION_TABS = [
  { id: 'datos', label: 'Datos del predio' },
  { id: 'ubicacion', label: 'Datos de la ubicación' },
  { id: 'transferentes', label: 'Datos del transferente' },
  { id: 'caracteristicas', label: 'Características' },
  { id: 'condominos', label: 'Datos de los condóminos' },
  { id: 'frentes', label: 'Otros frentes' }
] as const

// a form tab sends only its own fields, over the record as it is now: the other tabs of the same record may have
// saved meanwhile, and core's update replaces every field
export function camposDe(sections: SectionSpec[]): string[] {
  return dataFields(sections)
    .filter((f) => !f.readOnly)
    .map((f) => f.name)
}

function sobre<T extends object>(latest: T, values: object, campos: string[]): T {
  const own = Object.fromEntries(campos.map((name) => [name, (values as Record<string, unknown>)[name] ?? null]))
  return { ...latest, ...own }
}

// the tabs that are forms: edited in place, saved together from the header
const FORMULARIOS = ['datos', 'ubicacion', 'caracteristicas'] as const
type Formulario = (typeof FORMULARIOS)[number]
// the predio's tipo, in datos del predio and in the ubicación: one value
export const COMUNES = ['tipo_predio'] as const
const etiqueta = (tab: string) => DECLARACION_TABS.find((t) => t.id === tab)?.label ?? tab

// of a form's changes, the fields that are this record's
const propios = (cambios: Record<string, unknown> | undefined, sections: SectionSpec[], ajenos: string[] = []) =>
  cambios ? camposDe(sections).filter((c) => c in cambios && !ajenos.includes(c)) : []

// acquired from someone: the srtm's "datos del transferente" names who. a prescripción adquisitiva (or "otros") may
// have nobody to name
const CON_TRANSFERENTE = ['COMPRA', 'DONACION', 'HERENCIA', 'ANTICIPO DE LEGITIMA', 'ADJUDICACION', 'PERMUTA', 'DACION EN PAGO', 'APORTE']

// where the wizard goes once the declaration is presented: its transferente, when it came from someone and none is
// there yet; else its características, while they lack what they require. bases: as caracteristicasSections (empty
// right after presenting, since this runs before the predio's año has a parámetros query of its own: the DJ's own
// tab, once open, asks for them live)
export function siguientePendiente(declaracion: Declaracion, transferentes: number, bases: Set<string> = new Set()): string {
  if (transferentes === 0 && CON_TRANSFERENTE.includes(declaracion.tipo_adquisicion ?? '')) return 'transferentes'
  const valores = declaracion as unknown as FormValues
  const requerido = (f: FieldSpec) => (typeof f.required === 'function' ? f.required(valores) : f.required === true)
  const faltan = dataFields(caracteristicasSections(bases)).some((f) => requerido(f) && (valores[f.name] ?? '') === '')
  return faltan ? 'caracteristicas' : 'transferentes'
}

export function DeclaracionRoute() {
  const { id = '' } = useParams()
  return <DeclaracionPage key={id} id={id} />
}

function DeclaracionPage({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const ficha = useQuery({ queryKey: ['declaracion', id], queryFn: () => rentas.declaracionJurada(id) })
  const dj = ficha.data
  useWorkspaceTab(
    dj ? { path: `/declaraciones/${id}`, label: `DJ ${dj.declaracion.numero_declaracion ?? ''} ${dj.predio.codigo ?? ''}`.trim(), kind: 'declaracion' } : null
  )
  // the DJ's año's arbitrios: what its ordenanza cobra por (BASE_ARBITRIO) and lee de (DIMENSIONES_ARBITRIO), to
  // exigir frontis, área construida o la ubicación respecto a áreas verdes (wasichai/srtm-ui#94). mientras la query
  // carga o falla, ambos conjuntos quedan vacíos: los campos siguen opcionales, como hoy
  const parametrosArbitrio = useParametrosArbitrio(dj?.declaracion.anio ?? undefined)
  // parametrosArbitrio.data mantiene su referencia entre renders mientras la consulta no traiga datos distintos:
  // así bases, conInfluencia y las secciones no se recalculan en cada render, solo cuando la query cambia de veras
  const bases = useMemo(() => basesDeArbitrio(parametrosArbitrio.data?.parametros), [parametrosArbitrio.data])
  const conInfluencia = useMemo(() => dimensionesDeArbitrio(parametrosArbitrio.data?.parametros).has('INFLUENCIA'), [parametrosArbitrio.data])
  const seccionesCaracteristicas = useMemo(() => caracteristicasSections(bases), [bases])
  const seccionesUbicacion = useMemo(() => ubicacionSections(undefined, conInfluencia), [conInfluencia])
  // the wizard, right after presenting (?asistente): "Siguiente" walks the tabs in order, "Terminar" ends it
  const asistente = params.has('asistente')
  const activa = DECLARACION_TABS.find((t) => t.id === params.get('tab'))?.id ?? 'datos'
  const siguiente = DECLARACION_TABS[DECLARACION_TABS.findIndex((t) => t.id === activa) + 1]?.id
  const abrir = (tab: string, enAsistente = asistente) => setParams(enAsistente ? { tab, asistente: '1' } : { tab }, { replace: true })

  const grupo = useFormGroup(FORMULARIOS)
  const comun = useSharedFields(COMUNES)
  const pendientes = grupo.pending.map(etiqueta)
  const salida = useUnsavedChanges(pendientes)
  // a save or a Cancelar starts the forms again, from the declaration as it is then
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descartando, setDescartando] = useState(false)

  // what a refusal is about goes under its field, and its tab opens; anything else, under the buttons
  const rechazo = (e: unknown, de: Formulario[]) => {
    const con = grupo.errors(e, de)
    if (con.length > 0) abrir(con[0])
    else setError(errorMessage(e, 'No se pudo guardar'))
    return false
  }
  // the pending changes of every form tab, over the declaration and its predio as they are now (the other tabs, a
  // condómino's %, may have changed them; core's update replaces every field): one save each
  const guardar = async (): Promise<boolean> => {
    if (grupo.pending.length === 0) return true
    setError(null)
    setGuardado(false)
    setGuardando(true)
    try {
      const { values: valores, invalid: invalidos } = await grupo.changes()
      if (invalidos.length > 0) {
        abrir(invalidos[0])
        return false
      }
      const latest = await rentas.declaracionJurada(id)
      const deDatos = propios(valores.datos, DJ_DATOS_SECTIONS, DATOS_DEL_PREDIO)
      const deCaracteristicas = propios(valores.caracteristicas, seccionesCaracteristicas)
      const deUbicacion = propios(valores.ubicacion, seccionesUbicacion)
      // the tipo de predio shown in datos del predio is the predio's
      const tipoPredio = valores.datos?.tipo_predio as string | null | undefined
      const otroTipo = tipoPredio !== undefined && tipoPredio !== latest.predio.tipo_predio
      const predio = deUbicacion.length > 0 || otroTipo ? sobre(latest.predio, valores.ubicacion ?? {}, deUbicacion) : null
      if (predio && otroTipo) predio.tipo_predio = tipoPredio ?? null
      if (deDatos.length > 0 || deCaracteristicas.length > 0) {
        const declaracion = sobre(sobre(latest.declaracion, valores.datos ?? {}, deDatos), valores.caracteristicas ?? {}, deCaracteristicas)
        try {
          await rentas.actualizarDeclaracion(id, declaracion)
        } catch (e) {
          return rechazo(e, ['datos', 'caracteristicas'])
        }
      }
      if (predio) {
        try {
          await rentas.actualizarPredio(latest.predio.id!, predio)
        } catch (e) {
          return rechazo(e, ['datos', 'ubicacion'])
        }
      }
      await refresh()
      setVersion((v) => v + 1)
      comun.reset()
      setGuardado(true)
      return true
    } catch (e) {
      setError(errorMessage(e, 'No se pudo guardar'))
      return false
    } finally {
      setGuardando(false)
    }
  }
  const descartar = () => {
    setDescartando(false)
    setError(null)
    setVersion((v) => v + 1)
    comun.reset()
  }

  return (
    <QueryState query={ficha}>
      {({ declaracion, predio, contribuyente, actualizado }) => {
        // datos del predio shows a few of the predio's fields beside the declaration's
        const datos = {
          ...declaracion,
          codigo_predio: predio.codigo,
          numero_registro: predio.numero_registro,
          tipo_predio: predio.tipo_predio,
          fecha_actualizacion: actualizado ?? null
        }
        // an annulled one (a descargo) is only read: no way back
        const soloLectura = anulada(declaracion)
        const formulario = (nombre: Formulario, sections: SectionSpec[], values: object, options?: Record<string, string[]>) =>
          soloLectura ? (
            <FieldGrid sections={sections} values={values} />
          ) : (
            <RecordForm
              key={version}
              link={grupo.links[nombre]}
              shared={comun}
              hideActions
              sections={sections}
              options={options}
              initial={values}
              submitLabel="Guardar"
              onSubmit={guardar}
            />
          )
        const hayCambios = grupo.pending.length > 0
        return (
          <div className="space-y-5">
            <FichaHeader
              kind={
                <Link to={`/contribuyentes/${contribuyente.id}`} className="hover:text-link hover:underline">
                  {contribuyente.codigo ? `Contribuyente Nº ${contribuyente.codigo}` : 'Contribuyente'} - {contribuyente.nombre_completo}
                </Link>
              }
              title={`Declaración jurada predial${declaracion.numero_declaracion ? ` - ${declaracion.numero_declaracion}` : ''}`}
              badges={
                <>
                  <EstadoBadge estado={declaracion.estado ?? 'VIGENTE'} />
                  {declaracion.anio && <Badge>{declaracion.anio}</Badge>}
                  {declaracion.condicion_propiedad && <Badge>{declaracion.condicion_propiedad}</Badge>}
                  <Link to={`/predios/${predio.id}`} className="font-medium text-link hover:underline">
                    {predio.codigo}
                  </Link>
                  <span>· {predio.direccion}</span>
                </>
              }
              aside={
                // the srtm's Cancelar / Guardar (page 21): what is pending in any form tab; the lists save row by row
                soloLectura ? undefined : (
                  <div role="group" aria-label="Acciones de la declaración" className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <AnularDeclaracion declaracion={declaracion} />
                      <Button variant="secondary" disabled={!hayCambios || guardando} onClick={() => setDescartando(true)}>
                        <X className="size-4" />
                        Cancelar
                      </Button>
                      <Button variant={asistente ? 'secondary' : 'primary'} disabled={!hayCambios || guardando} onClick={() => void guardar()}>
                        <Save className="size-4" />
                        {guardando ? 'Guardando…' : 'Guardar'}
                      </Button>
                      {asistente &&
                        (siguiente ? (
                          <Button disabled={guardando} onClick={() => void guardar().then((ok) => ok && abrir(siguiente))}>
                            <ArrowRight className="size-4" />
                            Siguiente
                          </Button>
                        ) : (
                          <Button disabled={guardando} onClick={() => void guardar().then((ok) => ok && abrir(activa, false))}>
                            <Check className="size-4" />
                            Terminar
                          </Button>
                        ))}
                    </div>
                    {error && (
                      <Alert tone="danger" className="max-w-md text-right">
                        {error}
                      </Alert>
                    )}
                    {guardado && !hayCambios && (
                      <p role="status" className="text-sm text-ink-muted">
                        Cambios guardados
                      </p>
                    )}
                  </div>
                )
              }
            />
            {/* every tab is open: a step goes to its tab, as the tab does, still in the wizard */}
            {asistente && (
              <PasosAsistente pasos={DECLARACION_TABS} actual={activa} onIr={(tab) => abrir(tab)} instruccion={INSTRUCCIONES_DECLARACION[activa]} />
            )}
            {soloLectura && <AvisoAnulada declaracion={declaracion} />}
            <Card className="pb-4">
              <FichaTabs
                label="Secciones de la declaración jurada"
                active={activa}
                onChange={(tab) => abrir(tab)}
                tabs={[
                  {
                    ...DECLARACION_TABS[0],
                    icon: FileText,
                    render: () => <div className="px-6 pt-5">{formulario('datos', DJ_DATOS_SECTIONS, datos, opcionesDatos(catalogos.data))}</div>
                  },
                  {
                    ...DECLARACION_TABS[1],
                    icon: MapPin,
                    render: () => <div className="px-6 pt-5">{formulario('ubicacion', seccionesUbicacion, predio, catalogos.data?.predio)}</div>
                  },
                  {
                    ...DECLARACION_TABS[2],
                    icon: Users,
                    render: () => (
                      <div className="px-6 pt-5">
                        <TransferentesPanel declaracion={id} readOnly={soloLectura} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[3],
                    icon: Building2,
                    render: () => (
                      <div className="space-y-8 px-6 pt-5">
                        {formulario('caracteristicas', seccionesCaracteristicas, declaracion, catalogos.data?.declaracion_predial)}
                        <NivelesPanel declaracion={id} readOnly={soloLectura} />
                        <ObrasPanel declaracion={id} readOnly={soloLectura} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[4],
                    icon: Users,
                    // always open, unlike the srtm's: condición is derived here, so a propietario único's declaration is
                    // where its first condómino is added
                    render: () => (
                      <div className="px-6 pt-5">
                        <CondominosPanel declaracion={declaracion} predio={predio} readOnly={soloLectura} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[5],
                    icon: Signpost,
                    render: () => (
                      <div className="px-6 pt-5">
                        <FrentesPanel declaracion={id} readOnly={soloLectura} />
                      </div>
                    )
                  }
                ]}
              />
            </Card>
            {salida.dialog}
            {descartando && (
              <ConfirmDiscard
                title="¿Descartar los cambios?"
                pending={pendientes}
                consequence="Si los descartas, se pierden."
                confirmLabel="Descartar cambios"
                onConfirm={descartar}
                onKeep={() => setDescartando(false)}
              />
            )}
          </div>
        )
      }}
    </QueryState>
  )
}
