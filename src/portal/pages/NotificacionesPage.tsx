import { useQueryClient } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Alert, Button, Card, CardBody, Input, Label, Pagination, Table, Td, Textarea, Th } from '@wasichai/ui'
import { FilePlus, Search } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { rentas } from '../api'
import { BadgeDeMapa, type EtiquetaDeMapa } from '../components/BadgeDeMapa'
import { DialogoDeActo } from '../components/DialogoDeActo'
import { formatDate, formatText, today } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { usePuede } from '../components/permisos'
import { describirContribuyente } from '../forms/bloques'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import { claves, useNotificaciones } from '../queries'
import type { FiltrosNotificaciones, NotificacionPrevia, NuevaNotificacion, Pagina, Predio } from '../types'
import { SubnavInfracciones } from './SubnavInfracciones'

// the notificaciones previas: what an inspector served before an acta, with the plazo it gave to put things right. its
// vencimiento, whether it is vencida at a day, its subsanación and the acta it led to are the backend's (one definition
// of vencida, SPEC §6): nothing here adds days to a date. a subsanación is an act of its own, impeded with why when the
// row already says it cannot be (subsanada, with an acta, vencida) or the account may not

const describirPredio = (p: Predio): Picked => ({ id: p.id!, label: `${p.codigo ?? 's/c'} · ${p.direccion ?? ''}` })

// whether it is vencida at vencidas_a, as the backend says. without a plazo nothing makes it vencida
export const VENCIDA: Record<string, EtiquetaDeMapa> = {
  VENCIDA: { texto: 'Vencida', tono: 'rojo' },
  EN_PLAZO: { texto: 'No vencida', tono: 'verde' },
  SIN_PLAZO: { texto: 'Sin plazo', tono: '' }
}
export const vencida = (n: NotificacionPrevia) => (n.vencida ? 'VENCIDA' : n.plazo_dias === null ? 'SIN_PLAZO' : 'EN_PLAZO')

// why a notificación cannot be subsanada, from what the backend answered for its row (null: it can)
function motivoSinSubsanar(n: NotificacionPrevia, puede: boolean): string | null {
  if (n.subsanada) return `Ya se subsanó el ${formatDate(n.subsanada.fecha)}.`
  if (n.acta) return `Ya originó el acta ${n.acta.numero}: no se subsana.`
  if (n.vencida) return `Vencida al ${formatDate(n.vencidas_a)}: fuera de plazo.`
  if (!puede) return 'Sin permiso: subsanar pide creación sobre las subsanaciones de notificación.'
  return null
}

interface Borrador {
  numero: string
  contribuyente: Picked | null
  desde: string
  hasta: string
  vencidas_a: string
}

export function NotificacionesPage() {
  const [filtros, setFiltros] = useState<FiltrosNotificaciones>(() => ({ vencidas_a: today() }))
  const [borrador, setBorrador] = useState<Borrador>(() => ({ numero: '', contribuyente: null, desde: '', hasta: '', vencidas_a: today() }))
  const [page, setPage] = useState(0)
  const query = useNotificaciones(filtros, page)
  const puedeRegistrar = usePuede('notificacion_administrativa')
  const puedeSubsanar = usePuede('subsanacion_notificacion')
  const [nueva, setNueva] = useState(false)
  const [subsanando, setSubsanando] = useState<NotificacionPrevia | null>(null)

  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setFiltros({
      numero: borrador.numero.trim() || undefined,
      contribuyente: borrador.contribuyente?.id,
      desde: borrador.desde || undefined,
      hasta: borrador.hasta || undefined,
      vencidas_a: borrador.vencidas_a || today()
    })
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <SubnavInfracciones />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Notificaciones previas</h1>
          <p className="text-sm text-ink-muted">
            Lo que se notificó antes de un acta y el plazo que dio para subsanar. Vencida o no, a la fecha que se elija, lo dice el sistema.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="secondary" disabled={!puedeRegistrar} onClick={() => setNueva(true)}>
            <FilePlus className="size-4" />
            Nueva notificación
          </Button>
          {!puedeRegistrar && <p className="text-xs text-ink-muted">Sin permiso: registrar pide creación sobre las notificaciones administrativas.</p>}
        </div>
      </div>

      <Card>
        <CardBody>
          <form role="search" aria-label="Filtros de las notificaciones" onSubmit={buscar} className="flex flex-wrap items-end gap-4">
            <Campo etiqueta="Número">
              {(id) => <Input id={id} value={borrador.numero} onChange={(e) => setBorrador({ ...borrador, numero: e.target.value })} />}
            </Campo>
            <div className="min-w-64">
              <RecordPicker
                label="Contribuyente"
                placeholder="DNI, RUC o nombre"
                value={borrador.contribuyente}
                onChange={(contribuyente) => setBorrador({ ...borrador, contribuyente })}
                onQuitar={() => setBorrador({ ...borrador, contribuyente: null })}
                search={(q) => rentas.contribuyentes(q, 0, 8)}
                describe={describirContribuyente}
              />
            </div>
            <Campo etiqueta="Desde">
              {(id) => <Input id={id} type="date" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />}
            </Campo>
            <Campo etiqueta="Hasta">
              {(id) => <Input id={id} type="date" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />}
            </Campo>
            <Campo etiqueta="Vencidas al">
              {(id) => (
                <Input id={id} type="date" required value={borrador.vencidas_a} onChange={(e) => setBorrador({ ...borrador, vencidas_a: e.target.value })} />
              )}
            </Campo>
            <Button type="submit">
              <Search className="size-4" />
              Buscar
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <QueryState query={query}>
          {(resultado) => (
            <Listado resultado={resultado} vencidasA={filtros.vencidas_a ?? today()} puede={puedeSubsanar} onPage={setPage} onSubsanar={setSubsanando} />
          )}
        </QueryState>
      </Card>

      {nueva && <DialogoNueva onCerrar={() => setNueva(false)} />}
      {subsanando && <DialogoSubsanar notificacion={subsanando} onCerrar={() => setSubsanando(null)} />}
    </div>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children(id)}
    </div>
  )
}

function Listado({
  resultado,
  vencidasA,
  puede,
  onPage,
  onSubsanar
}: {
  resultado: Pagina<NotificacionPrevia>
  vencidasA: string
  puede: boolean
  onPage: (page: number) => void
  onSubsanar: (n: NotificacionPrevia) => void
}) {
  // the day the backend derived vencida at: the one its rows carry, else the one asked
  const al = formatDate(resultado.content[0]?.vencidas_a ?? vencidasA)
  if (resultado.content.length === 0) {
    return (
      <EmptyState title="Ninguna notificación previa">
        <p>Cambie los filtros, o registre una con «Nueva notificación».</p>
      </EmptyState>
    )
  }
  return (
    <>
      <Table aria-label={`Notificaciones previas, vencidas al ${al}`}>
        <thead>
          <tr>
            <Th>Número</Th>
            <Th>Fecha</Th>
            <Th>Administrado</Th>
            <Th>Dirección</Th>
            <Th>Motivo</Th>
            <Th {...NUMERICA}>Plazo</Th>
            <Th>Vencimiento</Th>
            <Th>Vencida al {al}</Th>
            <Th>Subsanada</Th>
            <Th>Acta</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {resultado.content.map((n) => {
            const motivo = motivoSinSubsanar(n, puede)
            return (
              <tr key={n.id}>
                <Td className="font-semibold">{n.numero}</Td>
                <Td className="whitespace-nowrap">{formatDate(n.fecha)}</Td>
                <Td>
                  {n.contribuyente ? (
                    <Link to={`/contribuyentes/${n.contribuyente}`} className="text-link hover:underline">
                      {n.contribuyente_nombre ?? 'Ver contribuyente'}
                    </Link>
                  ) : (
                    formatText(n.contribuyente_nombre)
                  )}
                </Td>
                <Td>{n.direccion}</Td>
                <Td>{n.motivo}</Td>
                <Td {...NUMERICA}>{n.plazo_dias === null ? 'Sin plazo' : `${n.plazo_dias} ${n.plazo_dias === 1 ? 'día' : 'días'}`}</Td>
                <Td className="whitespace-nowrap">{n.vencimiento ? formatDate(n.vencimiento) : 'No vence'}</Td>
                <Td>
                  <BadgeDeMapa valor={vencida(n)} mapa={VENCIDA} />
                </Td>
                <Td className="whitespace-nowrap">{n.subsanada ? formatDate(n.subsanada.fecha) : 'No'}</Td>
                <Td>
                  {n.acta ? (
                    <Link to={`/infracciones/${n.acta.id}`} className="text-link hover:underline">
                      {n.acta.numero}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Button variant="secondary" size="sm" disabled={motivo !== null} onClick={() => onSubsanar(n)} aria-label={`Subsanar ${n.numero}`}>
                      Subsanar
                    </Button>
                    {motivo && <p className="text-xs text-ink-muted">{motivo}</p>}
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={onPage} />
    </>
  )
}

interface BorradorNueva {
  numero: string
  fecha: string
  contribuyente: Picked | null
  predio: Picked | null
  direccion: string
  motivo: string
  plazo_dias: string
}

// a plazo in whole days, more than none; blank is no plazo (it never falls due)
const plazoValido = (valor: string) => valor.trim() === '' || (Number.isInteger(Number(valor)) && Number(valor) > 0 && Number(valor) <= 32767)

// a notificación previa as served: the form's número, typed; its vencimiento is the backend's
function DialogoNueva({ onCerrar }: { onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const [b, setB] = useState<BorradorNueva>(() => ({
    numero: '',
    fecha: today(),
    contribuyente: null,
    predio: null,
    direccion: '',
    motivo: '',
    plazo_dias: ''
  }))
  const campo = (nombre: 'numero' | 'fecha' | 'direccion' | 'motivo' | 'plazo_dias') => ({
    value: b[nombre],
    onChange: (e: { target: { value: string } }) => setB({ ...b, [nombre]: e.target.value })
  })
  const completo = b.numero.trim() !== '' && b.fecha !== '' && b.direccion.trim() !== '' && b.motivo.trim() !== '' && plazoValido(b.plazo_dias)

  const cuerpo = (observacion: string): NuevaNotificacion => ({
    numero: b.numero.trim(),
    fecha: b.fecha,
    contribuyente: b.contribuyente?.id ?? null,
    predio: b.predio?.id ?? null,
    direccion: b.direccion.trim(),
    motivo: b.motivo.trim(),
    plazo_dias: b.plazo_dias.trim() === '' ? null : Number(b.plazo_dias),
    observacion
  })

  return (
    <DialogoDeActo<NotificacionPrevia>
      titulo="Nueva notificación previa"
      descripcion="El número es el del formulario notificado. Ninguna notificación se edita ni se borra después."
      completo={completo}
      porQue="Por qué se registra"
      accion="Registrar"
      siFalla="No se pudo registrar la notificación"
      enviar={(observacion) => rentas.registrarNotificacion(cuerpo(observacion))}
      onExito={() => queryClient.invalidateQueries({ queryKey: claves.infracciones })}
      exito={(n) => (
        <Alert tone="success">
          Notificación {n.numero} del {formatDate(n.fecha)} registrada.
          {n.vencimiento ? ` Vence el ${formatDate(n.vencimiento)}.` : ' Sin plazo: no vence.'}
        </Alert>
      )}
      onCerrar={onCerrar}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Número">{(id) => <Input id={id} required maxLength={20} {...campo('numero')} />}</Campo>
        <Campo etiqueta="Fecha">{(id) => <Input id={id} type="date" required {...campo('fecha')} />}</Campo>
      </div>
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
      <Campo etiqueta="Dirección">{(id) => <Input id={id} required maxLength={300} {...campo('direccion')} />}</Campo>
      <Campo etiqueta="Motivo">{(id) => <Textarea id={id} rows={2} required maxLength={500} {...campo('motivo')} />}</Campo>
      <Campo etiqueta="Plazo en días">{(id) => <Input id={id} type="number" min="1" step="1" {...campo('plazo_dias')} />}</Campo>
    </DialogoDeActo>
  )
}

// the subsanación: on a day (today when blank), never a future one; the backend refuses it when vencida that day
function DialogoSubsanar({ notificacion, onCerrar }: { notificacion: NotificacionPrevia; onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const [fecha, setFecha] = useState('')
  return (
    <DialogoDeActo
      titulo={`Subsanar la notificación ${notificacion.numero}`}
      descripcion={
        notificacion.vencimiento
          ? `Notificada el ${formatDate(notificacion.fecha)}, vence el ${formatDate(notificacion.vencimiento)}. Una notificación subsanada ya no origina un acta.`
          : `Notificada el ${formatDate(notificacion.fecha)}, sin plazo. Una notificación subsanada ya no origina un acta.`
      }
      porQue="Por qué se subsana"
      accion="Subsanar"
      siFalla="No se pudo subsanar"
      enviar={(observacion) => rentas.subsanarNotificacion(notificacion.id, fecha ? { fecha, observacion } : { observacion })}
      onExito={() => queryClient.invalidateQueries({ queryKey: claves.infracciones })}
      onCerrar={onCerrar}
    >
      <Campo etiqueta="Fecha de la subsanación">
        {(id) => (
          <>
            <Input id={id} type="date" max={today()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <p className="text-xs text-ink-muted">En blanco: hoy.</p>
          </>
        )}
      </Campo>
    </DialogoDeActo>
  )
}
