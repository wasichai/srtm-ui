import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Textarea } from '@wasichai/ui'
import { Loader2 } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { rentas, RentasError } from '../api'
import { Alerta } from '../components/Alerta'
import { DesgloseMulta, REINCIDENCIAS } from '../components/DesgloseMulta'
import { MensajeDeError, OBSERVACION_MAXIMA, OBSERVACION_MINIMA } from '../components/DialogoDeActo'
import { formatDate, today } from '../components/format'
import { usePuede } from '../components/permisos'
import { describirContribuyente } from '../forms/bloques'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import { claves, useCuis } from '../queries'
import type { ActaCreada, GradoReincidencia, NotificacionPrevia, NuevaActa, Pagina, Predio } from '../types'
import { SubnavInfracciones } from './SubnavInfracciones'

// a new acta de constatación: the form's número, typed; the CUIS code in force on the day of the infracción (the list
// follows that date) and the grade of reincidencia the inspector declares. the obligado is chosen, never deduced from
// the contribuyente. the multa is the backend's: it reads the UIT and the CUIS of that day, computes the desglose and
// freezes it in the acta, and this page shows what it answered. what it lacks to compute (faltan) is named, never a 0

const describirPredio = (p: Predio): Picked => ({ id: p.id!, label: `${p.codigo ?? 's/c'} · ${p.direccion ?? ''}` })
const describirNotificacion = (n: NotificacionPrevia): Picked => ({
  id: n.id,
  label: `${n.numero} · ${formatDate(n.fecha)} · ${n.contribuyente_nombre ?? n.direccion}`
})

// the notificaciones previas an acta may come from: not subsanadas, and without an acta of their own
async function previasAbiertas(numero: string): Promise<Pagina<NotificacionPrevia>> {
  const pagina = await rentas.notificaciones({ numero }, 0, 8)
  return { ...pagina, content: pagina.content.filter((n) => !n.subsanada && !n.acta) }
}

interface Borrador {
  numero: string
  fecha_infraccion: string
  hora_infraccion: string
  lugar: string
  codigo: string
  reincidencia: GradoReincidencia
  obligado: Picked | null
  contribuyente: Picked | null
  predio: Picked | null
  notificacion_previa: Picked | null
  expediente: string
  inspector: string
  descripcion_hecho: string
  observacion: string
}

const nuevo = (): Borrador => ({
  numero: '',
  fecha_infraccion: today(),
  hora_infraccion: '',
  lugar: '',
  codigo: '',
  reincidencia: 'PRIMERA',
  obligado: null,
  contribuyente: null,
  predio: null,
  notificacion_previa: null,
  expediente: '',
  inspector: '',
  descripcion_hecho: '',
  observacion: ''
})

const opcional = (valor: string) => valor.trim() || null

export function NuevaActaPage() {
  const [b, setB] = useState<Borrador>(nuevo)
  const puede = usePuede('papeleta')
  const queryClient = useQueryClient()
  const cuis = useCuis({ vigentes_a: b.fecha_infraccion || today() })
  const codigos = cuis.data?.codigos ?? []
  // a code picked for another date is no longer in the list: it counts as not picked
  const elegido = codigos.find((c) => c.codigo === b.codigo) ?? null

  const registro = useMutation({
    mutationFn: (body: NuevaActa) => rentas.registrarActa(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.infracciones })
  })

  const largo = b.observacion.trim().length
  // what still keeps the acta from being sent, in the clerk's words
  const faltaEnElFormulario = [
    !b.numero.trim() && 'el número',
    !b.fecha_infraccion && 'la fecha',
    !b.lugar.trim() && 'el lugar',
    !elegido && 'el código CUIS',
    !b.obligado && 'el obligado',
    !b.contribuyente && !b.predio && 'el contribuyente o el predio',
    (largo < OBSERVACION_MINIMA || largo > OBSERVACION_MAXIMA) && 'la observación'
  ].filter((x): x is string => Boolean(x))

  const texto = (nombre: 'numero' | 'fecha_infraccion' | 'hora_infraccion' | 'lugar' | 'expediente' | 'inspector' | 'descripcion_hecho' | 'observacion') => ({
    value: b[nombre],
    onChange: (e: { target: { value: string } }) => setB({ ...b, [nombre]: e.target.value })
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!puede || faltaEnElFormulario.length > 0 || registro.isPending || !elegido || !b.obligado) return
    registro.mutate({
      numero: b.numero.trim(),
      fecha_infraccion: b.fecha_infraccion,
      hora_infraccion: b.hora_infraccion || null,
      lugar: b.lugar.trim(),
      codigo: elegido.codigo,
      reincidencia: b.reincidencia,
      obligado: b.obligado.id,
      contribuyente: b.contribuyente?.id ?? null,
      predio: b.predio?.id ?? null,
      notificacion_previa: b.notificacion_previa?.id ?? null,
      expediente: opcional(b.expediente),
      inspector: opcional(b.inspector),
      descripcion_hecho: opcional(b.descripcion_hecho),
      observacion: b.observacion.trim()
    })
  }

  if (registro.isSuccess) {
    return (
      <Registrada
        acta={registro.data}
        onOtra={() => {
          registro.reset()
          setB(nuevo())
        }}
      />
    )
  }

  const faltan = registro.error instanceof RentasError ? registro.error.faltan : []
  const fechaDicha = formatDate(b.fecha_infraccion || today())

  return (
    <div className="space-y-5">
      <SubnavInfracciones />
      <div>
        <h1 className="text-xl font-semibold text-ink">Nueva acta</h1>
        <p className="text-sm text-ink-muted">
          El acta de constatación tal como la levantó el inspector. La multa la cifra el sistema con la UIT y el CUIS del día de la infracción, y queda
          congelada en el acta. Ninguna acta se edita ni se borra después.
        </p>
      </div>

      <form onSubmit={submit} aria-label="Nueva acta" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>La infracción</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Número de acta" requerido>
                {(id) => <Input id={id} required maxLength={20} {...texto('numero')} />}
              </Campo>
              <Campo etiqueta="Fecha de la infracción" requerido>
                {(id) => <Input id={id} type="date" required max={today()} {...texto('fecha_infraccion')} />}
              </Campo>
              <Campo etiqueta="Hora">{(id) => <Input id={id} type="time" {...texto('hora_infraccion')} />}</Campo>
            </div>
            <Campo etiqueta="Lugar" requerido>
              {(id) => <Input id={id} required maxLength={300} {...texto('lugar')} />}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Campo etiqueta="Código CUIS" requerido>
                  {(id) => (
                    <select
                      id={id}
                      required
                      className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink"
                      value={elegido?.codigo ?? ''}
                      onChange={(e) => setB({ ...b, codigo: e.target.value })}
                    >
                      <option value="">{cuis.isPending ? 'Cargando el CUIS…' : `Elija un código vigente al ${fechaDicha}`}</option>
                      {codigos.map((c) => (
                        <option key={c.id} value={c.codigo}>
                          {c.codigo} · {c.descripcion}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
              </div>
              <Campo etiqueta="Reincidencia" requerido>
                {(id) => (
                  <select
                    id={id}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                    value={b.reincidencia}
                    onChange={(e) => setB({ ...b, reincidencia: e.target.value as GradoReincidencia })}
                  >
                    {(Object.keys(REINCIDENCIAS) as GradoReincidencia[]).map((grado) => (
                      <option key={grado} value={grado}>
                        {REINCIDENCIAS[grado]}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
            {cuis.isSuccess && codigos.length === 0 && (
              <Alerta tono="atencion">Ningún código del CUIS está vigente al {fechaDicha}: cargue el CUIS o revise la fecha.</Alerta>
            )}
            {cuis.isError && (
              <Alerta tono="error">
                <MensajeDeError error={cuis.error} siFalla="No se pudo leer el CUIS" />
              </Alerta>
            )}
            {cuis.data && cuis.data.faltan.length > 0 && (
              <Alerta tono="atencion" titulo={`Al ${formatDate(cuis.data.vigentes_a)} falta:`}>
                {cuis.data.faltan.join('; ')}. Sin eso no se cifra la multa del acta.
              </Alerta>
            )}
            {elegido && (
              <p className="text-sm text-ink-muted" data-testid="codigo-elegido">
                {elegido.descripcion}. Base legal: {elegido.base_legal}.
                {elegido.medida_complementaria && ` Medida complementaria: ${elegido.medida_complementaria}.`}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>El administrado</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <RecordPicker
              label="Obligado"
              placeholder="DNI, RUC o nombre"
              value={b.obligado}
              onChange={(obligado) => setB({ ...b, obligado })}
              search={(q) => rentas.contribuyentes(q, 0, 8)}
              describe={describirContribuyente}
            />
            <p className="text-xs text-ink-muted">Quien responde por la multa. Se elige siempre: no se deduce del contribuyente ni del predio.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <RecordPicker
                label="Contribuyente"
                placeholder="DNI, RUC o nombre"
                value={b.contribuyente}
                onChange={(contribuyente) => setB({ ...b, contribuyente })}
                onQuitar={() => setB({ ...b, contribuyente: null })}
                search={(q) => rentas.contribuyentes(q, 0, 8)}
                describe={describirContribuyente}
              />
              <RecordPicker
                label="Predio"
                placeholder="Código o dirección"
                value={b.predio}
                onChange={(predio) => setB({ ...b, predio })}
                onQuitar={() => setB({ ...b, predio: null })}
                search={(q) => rentas.predios(q, 0, 8)}
                describe={describirPredio}
              />
            </div>
            <p className="text-xs text-ink-muted">El contribuyente o el predio: al menos uno de los dos.</p>
            <RecordPicker
              label="Notificación previa"
              placeholder="Número de la notificación"
              value={b.notificacion_previa}
              onChange={(notificacion_previa) => setB({ ...b, notificacion_previa })}
              onQuitar={() => setB({ ...b, notificacion_previa: null })}
              search={previasAbiertas}
              describe={describirNotificacion}
            />
            <p className="text-xs text-ink-muted">Opcional. Solo las no subsanadas y sin acta: una notificación subsanada no origina un acta.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>El expediente</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Número de expediente">{(id) => <Input id={id} maxLength={20} {...texto('expediente')} />}</Campo>
              <Campo etiqueta="Inspector">{(id) => <Input id={id} maxLength={120} {...texto('inspector')} />}</Campo>
            </div>
            <Campo etiqueta="Descripción del hecho">{(id) => <Textarea id={id} rows={3} maxLength={1000} {...texto('descripcion_hecho')} />}</Campo>
            <Campo etiqueta="Observación" requerido>
              {(id) => (
                <>
                  <Textarea id={id} rows={3} maxLength={OBSERVACION_MAXIMA + 50} {...texto('observacion')} />
                  <p className="text-xs text-ink-muted">
                    Por qué se registra: de {OBSERVACION_MINIMA} a {OBSERVACION_MAXIMA} caracteres ({largo}).
                  </p>
                </>
              )}
            </Campo>
          </CardBody>
        </Card>

        {registro.isError &&
          (faltan.length > 0 ? (
            <Alerta tono="atencion" titulo="No se registró el acta. Falta:">
              {faltan.join('; ')}. Sin eso no se cifra la multa: cárguelo y vuelva a intentarlo.
            </Alerta>
          ) : (
            <Alerta tono="error">
              <MensajeDeError error={registro.error} siFalla="No se pudo registrar el acta" />
            </Alerta>
          ))}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!puede ? (
            <p className="text-xs text-ink-muted">Sin permiso: registrar un acta pide creación sobre las papeletas.</p>
          ) : (
            faltaEnElFormulario.length > 0 && <p className="text-xs text-ink-muted">Para registrar falta: {faltaEnElFormulario.join(', ')}.</p>
          )}
          <Button type="submit" disabled={!puede || faltaEnElFormulario.length > 0 || registro.isPending}>
            {registro.isPending && <Loader2 className="size-4 animate-spin" />}
            Registrar acta
          </Button>
        </div>
      </form>
    </div>
  )
}

function Campo({ etiqueta, requerido = false, children }: { etiqueta: string; requerido?: boolean; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>
        {etiqueta}
        {requerido && <span className="text-danger"> *</span>}
      </Label>
      {children(id)}
    </div>
  )
}

// what the backend wrote: the acta, its stable reference and the multa it computed and froze
function Registrada({ acta, onOtra }: { acta: ActaCreada; onOtra: () => void }) {
  const fecha = acta.desglose.fecha_calculo ?? acta.fecha_calculo
  return (
    <div className="space-y-5">
      <SubnavInfracciones />
      <Alerta tono="exito">
        Acta {acta.numero} del {formatDate(acta.fecha_infraccion)} registrada, con la referencia {acta.referencia}.
      </Alerta>
      <Card>
        <CardHeader>
          <CardTitle>Multa del acta {acta.numero}</CardTitle>
        </CardHeader>
        <CardBody>
          <DesgloseMulta desglose={acta.desglose} fecha={fecha} referencia={acta.referencia} />
        </CardBody>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Link to={`/infracciones/${acta.id}`} className="text-sm font-medium text-link hover:underline">
          Ver el expediente
        </Link>
        <Button variant="secondary" onClick={onOtra}>
          Registrar otra acta
        </Button>
      </div>
    </div>
  )
}
