import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, CardHeader, CardTitle, Input, Label, Table, Td, Textarea, Th } from '@wasichai/ui'
import { FileText, Gavel, MailCheck, MessageSquareText } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { rentas } from '../api'
import { DialogoDeActo } from '../components/DialogoDeActo'
import { formatDate, formatText, today } from '../components/format'
import { PdfDialog } from '../components/PdfDialog'
import { usePuede } from '../components/permisos'
import { claves } from '../queries'
import type {
  AccionPermitida,
  DescargoPapeleta,
  EfectoMulta,
  ExpedienteInfraccion,
  ModalidadNotificacion,
  NotificacionResolucion,
  NuevaNotificacionResolucion,
  NuevaResolucion,
  ResolucionGerencia,
  ResultadoNotificacion,
  SentidoFallo,
  TipoRecurso,
  TipoResolucionGerencia
} from '../types'

// the acts that follow an acta (SPEC §7, Multas): the administrado's descargos, the gerencia's resoluciones (the RIS
// that sanctions, the one that resolves a descargo) with their PDF, and each resolución's notificaciones. every plazo,
// en_plazo and exigible_desde is the backend's, shown as it came: nothing here counts días hábiles. what the legal order
// does not allow yet is the backend's reason (acciones.*.motivo); what the account may not do, the permiso's

export const TIPOS_RECURSO: Record<TipoRecurso, string> = {
  DESCARGO: 'Descargo',
  RECONSIDERACION: 'Reconsideración',
  APELACION: 'Apelación',
  NULIDAD: 'Nulidad'
}

export const TIPOS_RESOLUCION: Record<TipoResolucionGerencia, string> = {
  ADMINISTRATIVA: 'Administrativa (RIS)',
  RECURSO: 'De recurso (RGR)'
}

export const SENTIDOS: Record<SentidoFallo, string> = {
  FUNDADO: 'Fundado',
  FUNDADO_EN_PARTE: 'Fundado en parte',
  INFUNDADO: 'Infundado',
  IMPROCEDENTE: 'Improcedente'
}

export const EFECTOS: Record<EfectoMulta, string> = {
  SE_MANTIENE: 'Se mantiene la multa',
  SE_DEJA_SIN_EFECTO: 'Se deja sin efecto la multa',
  SE_REDUCE: 'Se reduce la multa'
}

// SPEC §0: the backend refuses SE_REDUCE (422) until the ordenanza gives a rule; offered, impeded, and why
export const SIN_REGLA_DE_REDUCCION = 'No hay regla de reducción: la fija la ordenanza (D-02b).'

export const MODALIDADES: Record<ModalidadNotificacion, string> = {
  PERSONAL: 'Personal',
  CEDULON: 'Cedulón',
  PUBLICACION: 'Publicación',
  CORREO: 'Correo'
}

export const RESULTADOS: Record<ResultadoNotificacion, string> = {
  NOTIFICADO: 'Notificado',
  NO_UBICADO: 'No ubicado',
  RECHAZADO: 'Rechazado'
}

const SELECT = 'h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink'

type Resolucion = ExpedienteInfraccion['resoluciones'][number]

// why an action cannot be done now: the legal order's reason first (the backend's), then the account's
export function impedimento(accion: AccionPermitida, puede: boolean, sinPermiso: string): string | null {
  if (!accion.permitida) return accion.motivo ?? 'El estado del expediente no lo admite.'
  if (!puede) return sinPermiso
  return null
}

const nuloSiVacio = (valor: string) => (valor.trim() === '' ? null : valor.trim())

function Campo({
  etiqueta,
  requerido = false,
  ayuda,
  children
}: {
  etiqueta: string
  requerido?: boolean
  ayuda?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {etiqueta}
        {requerido && <span className="text-danger"> *</span>}
      </Label>
      {children(id)}
      {ayuda && <p className="text-xs text-ink-muted">{ayuda}</p>}
    </div>
  )
}

// a button of an act with, under it, why it is impeded
export function AccionImpedible({ motivo, children }: { motivo: string | null; children: ReactNode }) {
  return (
    <div className="flex max-w-xs flex-col items-end gap-1">
      {children}
      {motivo && <p className="text-right text-xs text-ink-muted">{motivo}</p>}
    </div>
  )
}

const useInvalidar = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: claves.infracciones })
}

// ---- descargo

export function RegistrarDescargo({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  const puede = usePuede('descargo_papeleta')
  const [abierto, setAbierto] = useState(false)
  const motivo = impedimento(e.acciones.descargo, puede, 'Sin permiso: registrar un descargo pide creación sobre los descargos de papeleta.')
  return (
    <AccionImpedible motivo={motivo}>
      <Button variant="secondary" disabled={motivo !== null} onClick={() => setAbierto(true)}>
        <MessageSquareText className="size-4" />
        Registrar descargo
      </Button>
      {abierto && <DialogoDescargo expediente={e} onCerrar={() => setAbierto(false)} />}
    </AccionImpedible>
  )
}

// the plazo and whether it was met are the backend's: a descargo out of it is written all the same
export function PlazoDelDescargo({ descargo: d }: { descargo: DescargoPapeleta }) {
  return d.en_plazo ? <>Presentado dentro del plazo.</> : <>Fuera de plazo: se registra igual y se resuelve improcedente.</>
}

function DialogoDescargo({ expediente: e, onCerrar }: { expediente: ExpedienteInfraccion; onCerrar: () => void }) {
  const invalidar = useInvalidar()
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState<TipoRecurso>('DESCARGO')
  const [fecha, setFecha] = useState(today())
  const [sustento, setSustento] = useState('')
  return (
    <DialogoDeActo<DescargoPapeleta>
      titulo={`Registrar un descargo del acta ${e.acta.numero}`}
      descripcion="El escrito del administrado tal como se presentó. El plazo lo computa el sistema; uno fuera de plazo se registra igual."
      completo={numero.trim() !== '' && fecha !== '' && sustento.trim() !== ''}
      porQue="Por qué se registra"
      accion="Registrar"
      siFalla="No se pudo registrar el descargo"
      enviar={(observacion) =>
        rentas.registrarDescargo(e.acta.id, { numero_expediente: numero.trim(), tipo_recurso: tipo, fecha, sustento: sustento.trim(), observacion })
      }
      onExito={invalidar}
      exito={(d) => (
        <Alert tone={d.en_plazo ? 'success' : 'warning'} title={`Descargo ${d.numero_expediente} registrado.`}>
          Presentado el {formatDate(d.fecha)}; plazo {d.plazo_texto}, hasta el {formatDate(d.presentado_hasta)}. <PlazoDelDescargo descargo={d} />
        </Alert>
      )}
      onCerrar={onCerrar}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Número de expediente" requerido>
          {(id) => <Input id={id} required maxLength={20} value={numero} onChange={(ev) => setNumero(ev.target.value)} />}
        </Campo>
        <Campo etiqueta="Fecha de presentación" requerido>
          {(id) => <Input id={id} type="date" required max={today()} value={fecha} onChange={(ev) => setFecha(ev.target.value)} />}
        </Campo>
      </div>
      <Campo etiqueta="Tipo de recurso" requerido>
        {(id) => (
          <select id={id} className={SELECT} value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoRecurso)}>
            {(Object.keys(TIPOS_RECURSO) as TipoRecurso[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_RECURSO[t]}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo etiqueta="Sustento" requerido>
        {(id) => <Textarea id={id} rows={3} required maxLength={1000} value={sustento} onChange={(ev) => setSustento(ev.target.value)} />}
      </Campo>
    </DialogoDeActo>
  )
}

// ---- resolución

export function DictarResolucion({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  const puede = usePuede('resolucion_gerencia')
  const [abierto, setAbierto] = useState(false)
  const motivo = impedimento(e.acciones.resolucion, puede, 'Sin permiso: dictar una resolución pide creación sobre las resoluciones de gerencia.')
  return (
    <AccionImpedible motivo={motivo}>
      <Button variant="secondary" disabled={motivo !== null} onClick={() => setAbierto(true)}>
        <Gavel className="size-4" />
        Dictar resolución
      </Button>
      {abierto && <DialogoResolucion expediente={e} onCerrar={() => setAbierto(false)} />}
    </AccionImpedible>
  )
}

const describirDescargo = (d: DescargoPapeleta) => `${d.numero_expediente} · ${TIPOS_RECURSO[d.tipo_recurso] ?? d.tipo_recurso} del ${formatDate(d.fecha)}`

function DialogoResolucion({ expediente: e, onCerrar }: { expediente: ExpedienteInfraccion; onCerrar: () => void }) {
  const invalidar = useInvalidar()
  const [tipo, setTipo] = useState<TipoResolucionGerencia>('ADMINISTRATIVA')
  const [descargo, setDescargo] = useState('')
  const [sentido, setSentido] = useState<SentidoFallo | ''>('')
  const [efecto, setEfecto] = useState<EfectoMulta | ''>('')
  const [fecha, setFecha] = useState('')
  const [sustento, setSustento] = useState('')
  const [accesoria, setAccesoria] = useState('')
  const recurso = tipo === 'RECURSO'

  const falta = [
    ...(recurso && descargo === '' ? ['el descargo que resuelve'] : []),
    ...(recurso && sentido === '' ? ['el sentido del fallo'] : []),
    ...(recurso && efecto === '' ? ['el efecto sobre la multa'] : []),
    ...(sustento.trim() === '' ? ['el sustento'] : [])
  ]

  const cuerpo = (observacion: string): NuevaResolucion => ({
    tipo,
    descargo: recurso ? descargo : null,
    sentido: recurso && sentido !== '' ? sentido : null,
    efecto: recurso && efecto !== '' ? efecto : null,
    ...(fecha ? { fecha } : {}),
    sustento: sustento.trim(),
    sancion_accesoria: recurso ? null : nuloSiVacio(accesoria),
    observacion
  })

  return (
    <DialogoDeActo<ResolucionGerencia>
      titulo={`Dictar una resolución del acta ${e.acta.numero}`}
      descripcion="La administrativa (RIS) sanciona el acta: una por acta. La de recurso (RGR) resuelve un descargo: una por descargo. El número lo da el sistema y ninguna se edita después."
      completo={falta.length === 0}
      porQue="Por qué se dicta"
      accion="Dictar"
      siFalla="No se pudo dictar la resolución"
      enviar={(observacion) => rentas.dictarResolucion(e.acta.id, cuerpo(observacion))}
      onExito={invalidar}
      exito={(r) => (
        <div className="space-y-3">
          <Alert tone="success">
            Resolución {r.numero} dictada el {formatDate(r.fecha)}.
          </Alert>
          <VerPdfResolucion resolucion={r} etiqueta="Ver PDF" />
        </div>
      )}
      onCerrar={onCerrar}
    >
      <Campo etiqueta="Tipo" requerido>
        {(id) => (
          <select id={id} className={SELECT} value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoResolucionGerencia)}>
            {(Object.keys(TIPOS_RESOLUCION) as TipoResolucionGerencia[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_RESOLUCION[t]}
              </option>
            ))}
          </select>
        )}
      </Campo>
      {recurso && (
        <>
          {e.descargos.length === 0 && <Alert tone="warning">El acta no tiene descargos: una resolución de recurso resuelve un descargo.</Alert>}
          <Campo etiqueta="Descargo que resuelve" requerido>
            {(id) => (
              <select id={id} className={SELECT} value={descargo} onChange={(ev) => setDescargo(ev.target.value)}>
                <option value="">Elija el descargo</option>
                {e.descargos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {describirDescargo(d)}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Sentido del fallo" requerido>
              {(id) => (
                <select id={id} className={SELECT} value={sentido} onChange={(ev) => setSentido(ev.target.value as SentidoFallo | '')}>
                  <option value="">Elija el sentido</option>
                  {(Object.keys(SENTIDOS) as SentidoFallo[]).map((s) => (
                    <option key={s} value={s}>
                      {SENTIDOS[s]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta="Efecto sobre la multa" requerido>
              {(id) => (
                <select id={id} className={SELECT} value={efecto} onChange={(ev) => setEfecto(ev.target.value as EfectoMulta | '')}>
                  <option value="">Elija el efecto</option>
                  {(Object.keys(EFECTOS) as EfectoMulta[]).map((ef) => (
                    <option key={ef} value={ef} disabled={ef === 'SE_REDUCE'}>
                      {EFECTOS[ef]}
                      {ef === 'SE_REDUCE' && ' (no disponible)'}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          <p className="text-xs text-ink-muted" data-testid="sin-reduccion">
            {EFECTOS.SE_REDUCE}: {SIN_REGLA_DE_REDUCCION}
          </p>
        </>
      )}
      <Campo etiqueta="Fecha de la resolución" ayuda="En blanco: hoy.">
        {(id) => <Input id={id} type="date" max={today()} value={fecha} onChange={(ev) => setFecha(ev.target.value)} />}
      </Campo>
      <Campo etiqueta="Sustento" requerido>
        {(id) => <Textarea id={id} rows={3} required maxLength={1000} value={sustento} onChange={(ev) => setSustento(ev.target.value)} />}
      </Campo>
      {!recurso && (
        <Campo etiqueta="Sanción accesoria">
          {(id) => <Input id={id} maxLength={200} value={accesoria} onChange={(ev) => setAccesoria(ev.target.value)} />}
        </Campo>
      )}
      {falta.length > 0 && <p className="text-xs text-ink-muted">Para dictar falta: {falta.join(', ')}.</p>}
    </DialogoDeActo>
  )
}

// a resolución's PDF, drawn again by the backend from its frozen data
export function VerPdfResolucion({ resolucion: r, etiqueta }: { resolucion: Pick<ResolucionGerencia, 'id' | 'numero'>; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button
        variant={etiqueta ? 'secondary' : 'ghost'}
        size={etiqueta ? undefined : 'sm'}
        aria-label={`Ver PDF de ${r.numero}`}
        onClick={() => setAbierto(true)}
      >
        <FileText className="size-3.5" />
        {etiqueta ?? 'PDF'}
      </Button>
      {abierto && <PdfDialog path={rentas.pdfResolucion(r.id)} titulo={`Resolución ${r.numero}`} onClose={() => setAbierto(false)} />}
    </>
  )
}

// ---- notificación de una resolución

// whether it took effect is the backend's: exigible_desde comes only when it did
function EfectoDeLaNotificacion({ notificacion: n }: { notificacion: NotificacionResolucion }) {
  if (n.exigible_desde)
    return (
      <>
        Exigible desde el {formatDate(n.exigible_desde)}
        {n.plazo_texto && ` (plazo ${n.plazo_texto})`}.
      </>
    )
  return <>No surte efecto: {(RESULTADOS[n.resultado] ?? n.resultado).toLowerCase()}.</>
}

function Notificar({ resolucion: r, motivo }: { resolucion: Resolucion; motivo: string | null }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={motivo !== null}
        title={motivo ?? undefined}
        aria-label={`Notificar ${r.numero}`}
        onClick={() => setAbierto(true)}
      >
        <MailCheck className="size-3.5" />
        Notificar
      </Button>
      {abierto && <DialogoNotificacion resolucion={r} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

interface BorradorNotificacion {
  fecha_diligencia: string
  modalidad: ModalidadNotificacion
  resultado: ResultadoNotificacion
  notificador: string
  direccion: string
  receptor: string
  documento_receptor: string
  vinculo: string
  acuse: string
}

function DialogoNotificacion({ resolucion: r, onCerrar }: { resolucion: Resolucion; onCerrar: () => void }) {
  const invalidar = useInvalidar()
  const [b, setB] = useState<BorradorNotificacion>({
    fecha_diligencia: '',
    modalidad: 'PERSONAL',
    resultado: 'NOTIFICADO',
    notificador: '',
    direccion: '',
    receptor: '',
    documento_receptor: '',
    vinculo: '',
    acuse: ''
  })
  const campo = (nombre: keyof BorradorNotificacion) => ({
    value: b[nombre],
    onChange: (ev: { target: { value: string } }) => setB({ ...b, [nombre]: ev.target.value })
  })

  const cuerpo = (observacion: string): NuevaNotificacionResolucion => ({
    ...(b.fecha_diligencia ? { fecha_diligencia: b.fecha_diligencia } : {}),
    modalidad: b.modalidad,
    resultado: b.resultado,
    notificador: b.notificador.trim(),
    direccion: nuloSiVacio(b.direccion),
    receptor: nuloSiVacio(b.receptor),
    documento_receptor: nuloSiVacio(b.documento_receptor),
    vinculo: nuloSiVacio(b.vinculo),
    acuse: nuloSiVacio(b.acuse),
    observacion
  })

  return (
    <DialogoDeActo<NotificacionResolucion>
      titulo={`Notificar la resolución ${r.numero}`}
      descripcion="Un intento de notificación, tal como lo hizo el notificador. Desde cuándo es exigible lo computa el sistema; un intento no ubicado no surte efecto."
      completo={b.notificador.trim() !== ''}
      porQue="Por qué se registra"
      accion="Registrar"
      siFalla="No se pudo registrar la notificación"
      enviar={(observacion) => rentas.notificarResolucion(r.id, cuerpo(observacion))}
      onExito={invalidar}
      exito={(n) => (
        <Alert tone={n.exigible_desde ? 'success' : 'warning'} title={`Intento ${n.intento} registrado.`}>
          Diligencia del {formatDate(n.fecha_diligencia)} en {n.direccion}: {(RESULTADOS[n.resultado] ?? n.resultado).toLowerCase()}.{' '}
          <EfectoDeLaNotificacion notificacion={n} />
        </Alert>
      )}
      onCerrar={onCerrar}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Fecha de la diligencia" ayuda="En blanco: hoy.">
          {(id) => <Input id={id} type="date" max={today()} {...campo('fecha_diligencia')} />}
        </Campo>
        <Campo etiqueta="Modalidad" requerido>
          {(id) => (
            <select id={id} className={SELECT} value={b.modalidad} onChange={(ev) => setB({ ...b, modalidad: ev.target.value as ModalidadNotificacion })}>
              {(Object.keys(MODALIDADES) as ModalidadNotificacion[]).map((m) => (
                <option key={m} value={m}>
                  {MODALIDADES[m]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Resultado" requerido>
          {(id) => (
            <select id={id} className={SELECT} value={b.resultado} onChange={(ev) => setB({ ...b, resultado: ev.target.value as ResultadoNotificacion })}>
              {(Object.keys(RESULTADOS) as ResultadoNotificacion[]).map((m) => (
                <option key={m} value={m}>
                  {RESULTADOS[m]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
      <Campo etiqueta="Notificador" requerido>
        {(id) => <Input id={id} required maxLength={60} {...campo('notificador')} />}
      </Campo>
      <Campo etiqueta="Dirección" ayuda="Si la deja vacía, se usa el domicilio fiscal vigente a la fecha de la diligencia.">
        {(id) => <Input id={id} maxLength={300} {...campo('direccion')} />}
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Receptor">{(id) => <Input id={id} maxLength={120} {...campo('receptor')} />}</Campo>
        <Campo etiqueta="Documento del receptor">{(id) => <Input id={id} maxLength={20} {...campo('documento_receptor')} />}</Campo>
        <Campo etiqueta="Vínculo">{(id) => <Input id={id} maxLength={40} {...campo('vinculo')} />}</Campo>
        <Campo etiqueta="Acuse">{(id) => <Input id={id} maxLength={80} {...campo('acuse')} />}</Campo>
      </div>
    </DialogoDeActo>
  )
}

// ---- the lists of the ficha

const resueltoPor = (e: ExpedienteInfraccion, descargo: string) => e.resoluciones.find((r) => r.descargo === descargo)?.numero ?? null

export function Descargos({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Descargos</CardTitle>
      </CardHeader>
      {e.descargos.length === 0 ? (
        <p className="px-5 py-3 text-sm text-ink-muted">Sin descargos.</p>
      ) : (
        <Table aria-label="Descargos">
          <thead>
            <tr>
              <Th>Nº de expediente</Th>
              <Th>Tipo</Th>
              <Th>Presentado</Th>
              <Th>Plazo</Th>
              <Th>Presentado hasta</Th>
              <Th>En plazo</Th>
              <Th>Sustento</Th>
              <Th>Resuelto por</Th>
            </tr>
          </thead>
          <tbody>
            {e.descargos.map((d) => (
              <tr key={d.id}>
                <Td className="font-medium">{d.numero_expediente}</Td>
                <Td>{TIPOS_RECURSO[d.tipo_recurso] ?? d.tipo_recurso}</Td>
                <Td className="whitespace-nowrap">{formatDate(d.fecha)}</Td>
                <Td>{d.plazo_texto}</Td>
                <Td className="whitespace-nowrap">{formatDate(d.presentado_hasta)}</Td>
                <Td>{d.en_plazo ? 'Dentro del plazo' : 'Fuera de plazo'}</Td>
                <Td>{d.sustento}</Td>
                <Td>{formatText(resueltoPor(e, d.id))}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

const fallo = (r: ResolucionGerencia) =>
  r.sentido || r.efecto ? [r.sentido && (SENTIDOS[r.sentido] ?? r.sentido), r.efecto && (EFECTOS[r.efecto] ?? r.efecto)].filter(Boolean).join(' · ') : null

// why the legal order does not let a resolución be notified now (the backend's: an acta anulada or dejada sin efecto
// leaves nothing to notify); an older backend that sends no acciones impedes nothing
const impedimentoDeNotificar = (r: Resolucion) => {
  const accion = r.acciones?.notificacion
  return accion && !accion.permitida ? (accion.motivo ?? 'El estado del expediente no lo admite.') : null
}

// the PDF and «Notificar», with under them why the legal order impedes notifying (the account's reason is said once,
// under the table)
function AccionesDeResolucion({ resolucion: r, sinPermiso }: { resolucion: Resolucion; sinPermiso: string | null }) {
  const impedida = impedimentoDeNotificar(r)
  return (
    <>
      <div className="whitespace-nowrap">
        <VerPdfResolucion resolucion={r} />
        <Notificar resolucion={r} motivo={impedida ?? sinPermiso} />
      </div>
      {impedida && <p className="ml-auto max-w-xs text-right text-xs text-ink-muted">{impedida}</p>}
    </>
  )
}

export function Resoluciones({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  const puedeNotificar = usePuede('notificacion_resolucion')
  const sinPermiso = puedeNotificar ? null : 'Sin permiso: notificar pide creación sobre las notificaciones de resolución.'
  const descargo = (id: string | null) => (id ? (e.descargos.find((d) => d.id === id)?.numero_expediente ?? id) : null)
  const notificaciones = e.resoluciones.flatMap((r) => r.notificaciones.map((n) => ({ r, n })))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resoluciones</CardTitle>
      </CardHeader>
      {e.resoluciones.length === 0 ? (
        <p className="px-5 py-3 text-sm text-ink-muted">Sin resoluciones.</p>
      ) : (
        <>
          <Table aria-label="Resoluciones">
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Tipo</Th>
                <Th>Fecha</Th>
                <Th>Descargo</Th>
                <Th>Fallo</Th>
                <Th>Sanción accesoria</Th>
                <Th>Plazo de recurso</Th>
                <Th>Notificaciones</Th>
                <Th>
                  <span className="sr-only">Acciones</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {e.resoluciones.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium whitespace-nowrap">{r.numero}</Td>
                  <Td>{TIPOS_RESOLUCION[r.tipo] ?? r.tipo}</Td>
                  <Td className="whitespace-nowrap">{formatDate(r.fecha)}</Td>
                  <Td>{formatText(descargo(r.descargo))}</Td>
                  <Td>{formatText(fallo(r))}</Td>
                  <Td>{formatText(r.sancion_accesoria)}</Td>
                  <Td>{r.plazo_texto}</Td>
                  <Td>{r.notificaciones.length === 0 ? 'Sin notificar' : `${r.notificaciones.length} intento${r.notificaciones.length === 1 ? '' : 's'}`}</Td>
                  <Td className="text-right">
                    <AccionesDeResolucion resolucion={r} sinPermiso={sinPermiso} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {sinPermiso && <p className="px-5 py-2 text-xs text-ink-muted">{sinPermiso}</p>}
          {notificaciones.length > 0 && (
            <Table aria-label="Notificaciones de las resoluciones">
              <thead>
                <tr>
                  <Th>Resolución</Th>
                  <Th>Intento</Th>
                  <Th>Diligencia</Th>
                  <Th>Modalidad</Th>
                  <Th>Resultado</Th>
                  <Th>Dirección</Th>
                  <Th>Receptor</Th>
                  <Th>Exigible desde</Th>
                </tr>
              </thead>
              <tbody>
                {notificaciones.map(({ r, n }) => (
                  <tr key={n.id}>
                    <Td className="whitespace-nowrap">{r.numero}</Td>
                    <Td>{n.intento}</Td>
                    <Td className="whitespace-nowrap">{formatDate(n.fecha_diligencia)}</Td>
                    <Td>{MODALIDADES[n.modalidad] ?? n.modalidad}</Td>
                    <Td>{RESULTADOS[n.resultado] ?? n.resultado}</Td>
                    <Td>{n.direccion}</Td>
                    <Td>{formatText([n.receptor, n.documento_receptor, n.vinculo].filter(Boolean).join(' · ') || null)}</Td>
                    <Td className="whitespace-nowrap">
                      {n.exigible_desde ? `${formatDate(n.exigible_desde)}${n.plazo_texto ? ` (${n.plazo_texto})` : ''}` : 'No surte efecto'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </Card>
  )
}
