import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card } from '@wasichai/ui'
import { ArrowRight, FileText, MapPin, Undo2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { useSalidaConCambios } from '../components/CambiosPendientes'
import { FichaTabs } from '../components/FichaTabs'
import { currentYear, today } from '../components/format'
import { PasosAsistente } from '../components/PasosAsistente'
import { QueryState } from '../components/QueryState'
import { DATOS_DEL_PREDIO, DJ_DATOS_SECTIONS, opcionesDatos, ubicacionSections, UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { FieldGrid } from '../forms/FieldGrid'
import { useComun, useGrupoFormularios } from '../forms/grupo'
import { INSTRUCCIONES_NUEVA_DECLARACION } from '../forms/instrucciones'
import { RecordForm } from '../forms/RecordForm'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import type { Elegido } from '../forms/ubicacion'
import { emptyOf } from '../forms/specs'
import { useCatalogos, useRefresh } from '../queries'
import type { Contribuyente, Declaracion, Predio } from '../types'
import { CabeceraAsistente } from './CabeceraAsistente'
import { COMUNES, DECLARACION_TABS, siguientePendiente } from './DeclaracionPage'
import { AvisoTitulares, useTitularesDelPredio } from './TitularesDelPredio'

const DATOS_FORM = 'dj-datos'
const UBICACION_FORM = 'dj-ubicacion'
// besides the tipo de predio of both steps, the año and secuencia de uso the predio's titulares are looked up by, as
// the clerk leaves them: what is presented is datos del predio as it is now, gone back to by its tab or not
const SEGUIDOS = [...COMUNES, 'anio', 'secuencia_uso'] as const

// the padrón's district, in the selva: where a new predio most likely is
const PERENE = { ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE', region: 'SELVA' }

// datos del predio shows a few of the predio's fields beside the declaration's
type DatosDelPredio = Declaracion & { condicion?: string | null; codigo_predio?: string | null; numero_registro?: number | null }

const describeContribuyente = (c: Contribuyente): Picked => ({ id: c.id!, label: `${c.numero_documento ?? 's/d'} · ${c.nombre_completo ?? ''}` })

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
  const comun = useComun(SEGUIDOS)
  // one that already has a titular that year is not presented on: a condómino joins from that declaración
  const anio = comun.valores.anio === undefined ? datos?.anio : Number(comun.valores.anio) || null
  const titulares = useTitularesDelPredio(existente?.id, anio, comun.valores.secuencia_uso ?? datos?.secuencia_uso)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // what was typed in either step is lost by leaving: asked first
  const grupo = useGrupoFormularios(['datos', 'ubicacion'] as const)
  const salida = useSalidaConCambios(grupo.pendientes.map((tab) => DECLARACION_TABS.find((t) => t.id === tab)!.label))
  const [sections] = useState(() =>
    ubicacionSections((elegido: Elegido) => {
      const predio = elegido.kind === 'predio' ? elegido.predio : elegido.predio
      if (!predio) return false
      setBuscado(predio)
      // the declaration is on that predio: its tipo is the predio's
      if (predio.condicion) comun.cambiar('condicion', predio.condicion)
      setError(null)
      return true
    })
  )
  const tipoPredio = comun.valores.condicion ?? (datos as DatosDelPredio | null)?.condicion ?? 'URBANO'

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
      const actual = (await grupo.valores('datos')) as DatosDelPredio | null
      if (!actual) {
        setTab('datos')
        return
      }
      // datos del predio carries the predio's tipo; the declaration does not keep it. a predio of the padrón gets a
      // changed one saved first, over the predio as it is now (core's update replaces every field)
      const declaracion = Object.fromEntries(Object.entries(actual).filter(([k]) => !DATOS_DEL_PREDIO.includes(k))) as Declaracion
      if (predio.predio_id && actual.condicion && actual.condicion !== existente?.condicion) {
        const { predio: latest } = await rentas.predio(predio.predio_id, currentYear())
        await rentas.actualizarPredio(predio.predio_id, { ...latest, condicion: actual.condicion })
      }
      const dj = await rentas.presentarDeclaracion(titular, { declaracion, ...predio })
      await refresh()
      salida.permitir()
      // just presented: no transferentes yet
      navigate(`/declaraciones/${dj.declaracion.id}?tab=${siguientePendiente(dj.declaracion, 0)}&asistente=1`, { replace: true })
    } catch (e) {
      // what was refused goes under its field, in its step (this one, when the field is in both)
      const con = grupo.errores(e, ['datos', 'ubicacion'])
      if (con.length > 0) setTab(con.includes(tab) ? tab : con[0])
      else setError(e instanceof Error ? e.message : 'No se pudo guardar')
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
                      enlace={grupo.enlaces.datos}
                      comun={comun}
                      hideActions
                      sections={DJ_DATOS_SECTIONS}
                      options={opcionesDatos(catalogos.data)}
                      initial={emptyOf<DatosDelPredio>(DJ_DATOS_SECTIONS, {
                        condicion: predioFijo?.condicion ?? 'URBANO',
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
                            describe={describeContribuyente}
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
                      <FieldGrid sections={UBICACION_SECTIONS} values={{ ...existente, condicion: tipoPredio }} />
                    </div>
                  ) : (
                    <RecordForm
                      formId={UBICACION_FORM}
                      enlace={grupo.enlaces.ubicacion}
                      comun={comun}
                      hideActions
                      sections={sections}
                      options={catalogos.data?.predio}
                      initial={emptyOf<Predio>(sections, { ...PERENE, condicion: tipoPredio })}
                      submitLabel="Guardar"
                      onSubmit={(predio) => presentar({ predio })}
                    />
                  )}
                  {error && <Alerta tono="error">{error}</Alerta>}
                </div>
              )
          }))}
        />
      </Card>
      {salida.dialogo}
    </div>
  )
}
