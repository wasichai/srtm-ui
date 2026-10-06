import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { QueryState } from '@wasichai/core'
import { Alert, Button, Card } from '@wasichai/ui'
import { ArrowRight, FileText, MapPin, Undo2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { FieldGrid } from '../../kit/forms/FieldGrid'
import { useFormGroup, useSharedFields } from '../../kit/forms/group'
import { RecordForm } from '../../kit/forms/RecordForm'
import { emptyOf } from '../../kit/forms/spec'
import { errorMessage } from '../../kit/ui/errorMessage'
import { useUnsavedChanges } from '../../kit/ui/UnsavedChanges'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { currentYear, today } from '../components/format'
import { PasosAsistente } from '../components/PasosAsistente'
import { describirContribuyente, PERENE_PREDIO } from '../forms/bloques'
import { DATOS_DEL_PREDIO, DJ_DATOS_SECTIONS, opcionesDatos, ubicacionSections, UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { INSTRUCCIONES_NUEVA_DECLARACION } from '../forms/instrucciones'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import type { Elegido } from '../forms/ubicacion'
import { basesDeArbitrio, dimensionesDeArbitrio, parametrosArbitrioQuery, useCatalogos, useParametrosArbitrio, useRefresh } from '../queries'
import type { Declaracion, Predio } from '../types'
import { CabeceraAsistente } from './CabeceraAsistente'
import { COMUNES, DECLARACION_TABS, siguientePendiente } from './DeclaracionPage'
import { AvisoTitulares, useTitularesDelPredio } from './TitularesDelPredio'

const DATOS_FORM = 'dj-datos'
const UBICACION_FORM = 'dj-ubicacion'
// besides the tipo de predio of both steps, the año and secuencia de uso the predio's titulares are looked up by, as
// the clerk leaves them: what is presented is datos del predio as it is now, gone back to by its tab or not
const SEGUIDOS = [...COMUNES, 'anio', 'secuencia_uso'] as const

// datos del predio shows a few of the predio's fields beside the declaration's
type DatosDelPredio = Declaracion & { tipo_predio?: string | null; codigo_predio?: string | null; numero_registro?: number | null }

// /contribuyentes/:id/declaraciones/nueva from a contribuyente; /declaraciones/nueva?predio=<id> from a predio
export function NuevaDeclaracionRoute() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const predio = id ? undefined : (params.get('predio') ?? undefined)
  return <NuevaDeclaracionPage key={`${id ?? ''}:${predio ?? ''}`} contribuyente={id} predio={predio} />
}

// the srtm's "declaración jurada y registro de predio": step one the datos del predio, step two the ubicación, of a
// predio already in the padrón or of one registered here. "Siguiente" there presents it (it gets its number) and the
// wizard goes on in it, from its next pending tab; what the backend refuses goes back to the step it is about. it comes
// with its contribuyente, or with its predio (then the contribuyente is looked up in step one)
function NuevaDeclaracionPage({ contribuyente, predio }: { contribuyente?: string; predio?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const ficha = useQuery({
    queryKey: ['contribuyente', contribuyente, currentYear()],
    queryFn: () => rentas.contribuyente(contribuyente!, currentYear()),
    enabled: Boolean(contribuyente),
    placeholderData: keepPreviousData
  })
  const fijo = useQuery({ queryKey: ['predio', predio, currentYear()], queryFn: () => rentas.predio(predio!, currentYear()), enabled: Boolean(predio) })
  const [elegido, setElegido] = useState<Picked | null>(null)
  const [pickError, setPickError] = useState<string | undefined>()
  const titular = contribuyente ?? elegido?.id
  const [tab, setTab] = useState<'datos' | 'ubicacion'>('datos')
  const [datos, setDatos] = useState<Declaracion | null>(null)
  // a predio of the padrón picked with "buscar predios", or the one the wizard came with: the declaration is on it,
  // no new predio is registered
  const [buscado, setBuscado] = useState<Predio | null>(null)
  const predioFijo = fijo.data?.predio ?? null
  const existente = predioFijo ?? buscado
  // the tipo de predio of both steps is one value; the año and secuencia de uso are followed (SEGUIDOS)
  const comun = useSharedFields(SEGUIDOS)
  // one that already has a titular that year is not presented on: a condómino joins from that declaración
  const anio = comun.values.anio === undefined ? datos?.anio : Number(comun.values.anio) || null
  const titulares = useTitularesDelPredio(existente?.id, anio, comun.values.secuencia_uso ?? datos?.secuencia_uso)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // what was typed in either step is lost by leaving: asked first
  const grupo = useFormGroup(['datos', 'ubicacion'] as const)
  const salida = useUnsavedChanges(grupo.pending.map((tab) => DECLARACION_TABS.find((t) => t.id === tab)!.label))
  const [alElegir] = useState(() => (elegido: Elegido) => {
    const predio = elegido.kind === 'predio' ? elegido.predio : elegido.predio
    if (!predio) return false
    setBuscado(predio)
    // the declaration is on that predio: its tipo is the predio's
    if (predio.tipo_predio) comun.change('tipo_predio', predio.tipo_predio)
    setError(null)
    return true
  })
  // the ubicación step comes after datos del predio, which says the año: when a servicio of that año reads its tasa
  // by INFLUENCIA, a new predio is asked for its ubicación respecto a áreas verdes, as in the DJ (wasichai/srtm-ui#94).
  // while the query loads or fails, optional, as before
  const parametrosArbitrio = useParametrosArbitrio(anio ?? undefined)
  const conInfluencia = useMemo(() => dimensionesDeArbitrio(parametrosArbitrio.data?.parametros).has('INFLUENCIA'), [parametrosArbitrio.data])
  const sections = useMemo(() => ubicacionSections(alElegir, conInfluencia), [alElegir, conInfluencia])
  const tipoPredio = comun.values.tipo_predio ?? (datos as DatosDelPredio | null)?.tipo_predio ?? 'PREDIO URBANO'

  // one presentation at a time: a second "Siguiente" would register the declaration twice
  const enviando = useRef(false)
  const presentar = async (predio: { predio?: Predio; predio_id?: string }) => {
    if (!titular || enviando.current) return
    // a predio that already has a titular that year is joined from its declaración, not presented on
    if (predio.predio_id && titulares.length > 0) return
    enviando.current = true
    setError(null)
    setBusy(true)
    try {
      // datos del predio as it is now: the clerk may have gone back to it
      const actual = (await grupo.values('datos')) as DatosDelPredio | null
      if (!actual) {
        setTab('datos')
        return
      }
      // datos del predio carries the predio's tipo; the declaration does not keep it. a predio of the padrón gets a
      // changed one saved first, over the predio as it is now (core's update replaces every field)
      const declaracion = Object.fromEntries(Object.entries(actual).filter(([k]) => !DATOS_DEL_PREDIO.includes(k))) as Declaracion
      if (predio.predio_id && actual.tipo_predio && actual.tipo_predio !== existente?.tipo_predio) {
        const { predio: latest } = await rentas.predio(predio.predio_id, currentYear())
        await rentas.actualizarPredio(predio.predio_id, { ...latest, tipo_predio: actual.tipo_predio })
      }
      const dj = await rentas.presentarDeclaracion(titular, { declaracion, ...predio })
      await refresh()
      salida.allow()
      // just presented: no transferentes yet. las bases del año recién presentado, pedidas justo aquí por ese año
      // exacto - no las de un año que el clerk haya cambiado en el formulario mientras esto corría, ni las de un
      // año distinto que haya quedado en caché (wasichai/srtm-ui#94). queryClient.query, no fetchQuery (obsoleto en
      // query-core 5.103): igual que él, usa la caché mientras está fresca y lanza si la consulta falla. sin año, o
      // si falla, bases queda vacío: como hoy
      let bases = new Set<string>()
      if (dj.declaracion.anio != null) {
        try {
          const parametros = await queryClient.query(parametrosArbitrioQuery(dj.declaracion.anio))
          bases = basesDeArbitrio(parametros.parametros)
        } catch {
          // sin datos: bases queda vacío, como hoy
        }
      }
      navigate(`/declaraciones/${dj.declaracion.id}?tab=${siguientePendiente(dj.declaracion, 0, bases)}&asistente=1`, {
        replace: true
      })
    } catch (e) {
      // what was refused goes under its field, in its step (this one, when the field is in both)
      const con = grupo.errors(e, ['datos', 'ubicacion'])
      if (con.length > 0) setTab(con.includes(tab) ? tab : con[0])
      else setError(errorMessage(e, 'No se pudo guardar'))
    } finally {
      enviando.current = false
      setBusy(false)
    }
  }

  // where the tabs (and the steps, with the portal's theme) can go: datos del predio, and the ubicación once it is in
  const abierta = (t: string) => t === 'datos' || (t === 'ubicacion' && Boolean(datos))
  const ir = (next: string) => setTab(next === 'ubicacion' && datos ? 'ubicacion' : 'datos')

  const c = ficha.data?.contribuyente
  return (
    <div className="space-y-5">
      <CabeceraAsistente
        kind={
          c
            ? `${c.codigo ? `Contribuyente Nº ${c.codigo}` : 'Contribuyente'} - ${c.nombre_completo ?? ''}`
            : predioFijo
              ? `Predio ${predioFijo.codigo ?? ''} - ${predioFijo.direccion ?? ''}`
              : 'Contribuyente'
        }
        title="Nueva declaración jurada predial"
        detalle="Declaración jurada y registro de predio"
      >
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
          <Button type="submit" form={UBICACION_FORM} disabled={busy}>
            <ArrowRight className="size-4" />
            {busy ? 'Guardando…' : 'Siguiente'}
          </Button>
        ) : (
          <Button onClick={() => void presentar({ predio_id: existente.id })} disabled={busy || titulares.length > 0}>
            <ArrowRight className="size-4" />
            {busy ? 'Guardando…' : 'Siguiente'}
          </Button>
        )}
      </CabeceraAsistente>
      <PasosAsistente pasos={DECLARACION_TABS} actual={tab} onIr={ir} puedeIr={abierta} instruccion={INSTRUCCIONES_NUEVA_DECLARACION[tab]} />
      <Card className="pb-5">
        <FichaTabs
          label="Declaración jurada predial"
          active={tab}
          onChange={ir}
          tabs={DECLARACION_TABS.map((t) => ({
            ...t,
            icon: t.id === 'ubicacion' ? MapPin : FileText,
            disabled: !abierta(t.id),
            render: () =>
              t.id === 'datos' ? (
                <div className="px-6 pt-5">
                  {predio && !predioFijo ? (
                    // the predio's code and tipo go in the form's first values
                    <QueryState query={fijo}>{() => null}</QueryState>
                  ) : (
                    <RecordForm
                      formId={DATOS_FORM}
                      link={grupo.links.datos}
                      shared={comun}
                      hideActions
                      sections={DJ_DATOS_SECTIONS}
                      options={opcionesDatos(catalogos.data)}
                      initial={emptyOf<DatosDelPredio>(DJ_DATOS_SECTIONS, {
                        tipo_predio: predioFijo?.tipo_predio ?? 'PREDIO URBANO',
                        codigo_predio: predioFijo?.codigo ?? null,
                        numero_registro: predioFijo?.numero_registro ?? null,
                        motivo: 'INSCRIPCION',
                        medio_determinacion: 'DECLARACION JURADA',
                        medio_presentacion: 'FISICO',
                        fecha_presentacion: today(),
                        anio: currentYear(),
                        secuencia_uso: '001',
                        // what a sole titular gets; its 100 % is the backend's (a titular joining one would be refused it)
                        condicion_propiedad: 'PROPIETARIO UNICO'
                      })}
                      submitLabel="Siguiente"
                      onSubmit={async (values) => {
                        if (!titular) {
                          setPickError('Elige el contribuyente')
                          return
                        }
                        setDatos(values)
                        setTab('ubicacion')
                      }}
                    >
                      {!contribuyente && (
                        <div className="lg:w-1/2">
                          <RecordPicker
                            label="Contribuyente"
                            placeholder="DNI, RUC o nombre"
                            value={elegido}
                            onChange={(picked) => {
                              setElegido(picked)
                              setPickError(undefined)
                            }}
                            search={(q) => rentas.contribuyentes(q, 0, 8)}
                            describe={describirContribuyente}
                            error={pickError}
                          />
                        </div>
                      )}
                    </RecordForm>
                  )}
                </div>
              ) : (
                <div className="space-y-5 px-6 pt-5">
                  {existente ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand/40 bg-brand-soft px-4 py-3 text-sm">
                        <p className="text-brand-strong">
                          La declaración será sobre el predio <strong>{existente.codigo}</strong> del padrón · {existente.direccion}
                        </p>
                        {!predioFijo && (
                          <Button type="button" variant="secondary" size="sm" onClick={() => setBuscado(null)}>
                            <Undo2 className="size-4" />
                            Registrar un predio nuevo
                          </Button>
                        )}
                      </div>
                      {titulares.length > 0 && <AvisoTitulares titulares={titulares} contribuyente={titular} anio={anio} />}
                      <FieldGrid sections={UBICACION_SECTIONS} values={{ ...existente, tipo_predio: tipoPredio }} />
                    </div>
                  ) : (
                    <RecordForm
                      formId={UBICACION_FORM}
                      link={grupo.links.ubicacion}
                      shared={comun}
                      hideActions
                      sections={sections}
                      options={catalogos.data?.predio}
                      initial={emptyOf<Predio>(sections, { ...PERENE_PREDIO, tipo_predio: tipoPredio })}
                      submitLabel="Guardar"
                      onSubmit={(predio) => presentar({ predio })}
                    />
                  )}
                  {error && <Alert tone="danger">{error}</Alert>}
                </div>
              )
          }))}
        />
      </Card>
      {salida.dialog}
    </div>
  )
}
