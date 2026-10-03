import { useQueryClient } from '@tanstack/react-query'
import { QueryState } from '@wasichai/core'
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Table, Td, Textarea, Th } from '@wasichai/ui'
import { Ban } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { DesgloseMulta, porcentaje, REINCIDENCIAS } from '../components/DesgloseMulta'
import { DialogoDeActo } from '../components/DialogoDeActo'
import { EstadoDeudaBadge } from '../components/EstadoDeudaBadge'
import { FaseBadge } from '../components/FaseBadge'
import { formatDate, formatText, today } from '../components/format'
import { usePuede } from '../components/permisos'
import { claves, useExpediente } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import type { AccionPermitida, ExpedienteInfraccion } from '../types'
import { FichaHeader } from './FichaHeader'
import { SubnavInfracciones } from './SubnavInfracciones'

// an expediente de infracción (the prototype's inf-exp): its acta with the multa frozen on fecha_calculo and the CUIS
// version used, its acts in the legal order the backend gives, where it stands (fase at fase_al_dia) and its estado de
// la deuda, two names side by side. an action the legal order does not allow yet, or the account may not do, is shown
// impeded with why: the legal order's reason is the backend's (acciones.*.motivo), never decided here

export function ExpedienteRoute() {
  const { id } = useParams()
  return <ExpedientePage key={id} id={id!} />
}

const vigencia = (desde: string, hasta: string | null) => `${formatDate(desde)} – ${hasta ? formatDate(hasta) : 'en adelante'}`

function ExpedientePage({ id }: { id: string }) {
  const expediente = useExpediente(id)
  const acta = expediente.data?.acta
  useWorkspaceTab(acta ? { path: `/infracciones/${id}`, label: `Acta ${acta.numero}`, kind: 'expediente' } : null)

  return (
    <QueryState query={expediente}>
      {(e) => (
        <div className="space-y-5">
          <SubnavInfracciones />
          <FichaHeader
            kind="Expediente de infracción"
            title={`Acta ${e.acta.numero}`}
            badges={
              <>
                <span className="flex items-center gap-1" data-testid="fase">
                  Fase al {formatDate(e.fase_al_dia)}: <FaseBadge fase={e.fase} />
                </span>
                <span className="flex items-center gap-1" data-testid="estado-deuda">
                  · Estado de la deuda: <EstadoDeudaBadge estado={e.estado_de_la_deuda} />
                </span>
                <span>· Referencia {e.referencia}</span>
              </>
            }
            aside={<Anular expediente={e} />}
          />
          {e.anulacion && (
            <Alerta tono="aviso" titulo="Acta anulada.">
              El {formatDate(e.anulacion.fecha)}: {e.anulacion.motivo}
            </Alerta>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Acta de constatación</CardTitle>
              </CardHeader>
              <CardBody>
                <Datos expediente={e} />
              </CardBody>
            </Card>
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Multa</CardTitle>
                </CardHeader>
                <CardBody>
                  <DesgloseMulta desglose={e.acta} fecha={e.acta.fecha_calculo} referencia={e.referencia} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Código CUIS aplicado</CardTitle>
                </CardHeader>
                <CardBody>
                  <dl aria-label="Código CUIS aplicado" className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <Dato termino="Código">{e.codigo_infraccion.codigo}</Dato>
                    <Dato termino="Infracción">{e.codigo_infraccion.descripcion}</Dato>
                    <Dato termino="% UIT">{porcentaje(e.codigo_infraccion.porcentaje_uit)}</Dato>
                    <Dato termino="Vigencia">{vigencia(e.codigo_infraccion.vigencia_desde, e.codigo_infraccion.vigencia_hasta)}</Dato>
                    <Dato termino="Base legal">{e.codigo_infraccion.base_legal}</Dato>
                  </dl>
                  <p className="mt-2 text-xs text-ink-muted">La versión vigente el día de la infracción: una versión posterior no cambia esta acta.</p>
                </CardBody>
              </Card>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Actos del expediente</CardTitle>
            </CardHeader>
            <Actos expediente={e} />
          </Card>
        </div>
      )}
    </QueryState>
  )
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{termino}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  )
}

// the people and the predio are ids in the acta: each opens its ficha
function Ficha({ to, texto }: { to: string; texto: string }) {
  return (
    <Link to={to} className="text-link hover:underline">
      {texto}
    </Link>
  )
}

function Datos({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  const a = e.acta
  return (
    <dl aria-label="Datos del acta" className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <Dato termino="Nº de expediente">{formatText(a.expediente)}</Dato>
      <Dato termino="Nº de acta">{a.numero}</Dato>
      <Dato termino="Fecha">
        {formatDate(a.fecha_infraccion)}
        {a.hora_infraccion && ` ${a.hora_infraccion}`}
      </Dato>
      <Dato termino="Lugar">{a.lugar}</Dato>
      <Dato termino="Código CUIS">{e.codigo_infraccion.codigo}</Dato>
      <Dato termino="Reincidencia">{REINCIDENCIAS[a.reincidencia] ?? a.reincidencia}</Dato>
      <Dato termino="Medida complementaria">{formatText(a.medida_complementaria)}</Dato>
      <Dato termino="Obligado">
        <Ficha to={`/contribuyentes/${a.obligado}`} texto="Ver el obligado" />
      </Dato>
      <Dato termino="Contribuyente">{a.contribuyente ? <Ficha to={`/contribuyentes/${a.contribuyente}`} texto="Ver el contribuyente" /> : '—'}</Dato>
      <Dato termino="Predio">{a.predio ? <Ficha to={`/predios/${a.predio}`} texto="Ver el predio" /> : '—'}</Dato>
      <Dato termino="Notificación previa">
        {e.notificacion_previa ? `${e.notificacion_previa.numero} del ${formatDate(e.notificacion_previa.fecha)}` : 'Ninguna'}
      </Dato>
      <Dato termino="Inspector">{formatText(a.inspector)}</Dato>
      <Dato termino="Descripción del hecho">{formatText(a.descripcion_hecho)}</Dato>
    </dl>
  )
}

// the acts as the backend orders them (the legal order): never sorted here
function Actos({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  return (
    <>
      <Table aria-label="Actos del expediente">
        <thead>
          <tr>
            <Th>Nº</Th>
            <Th>Acto</Th>
            <Th>Fecha</Th>
            <Th>Documento</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {e.actos.map((acto) => (
            <tr key={`${acto.orden}-${acto.id}`}>
              <Td>{acto.orden}</Td>
              <Td className="font-medium">{acto.acto}</Td>
              <Td className="whitespace-nowrap">{formatDate(acto.fecha)}</Td>
              <Td>{formatText(acto.documento)}</Td>
              <Td>{formatText(acto.detalle)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="px-5 py-3 text-xs text-ink-muted">
        El orden es legal, no una preferencia: sin acta no hay resolución, y sin notificación la sanción no es exigible.
      </p>
    </>
  )
}

// why an action cannot be done now: the legal order's reason first (the backend's), then the account's
function impedimento(accion: AccionPermitida, puede: boolean, sinPermiso: string): string | null {
  if (!accion.permitida) return accion.motivo ?? 'El estado del expediente no lo admite.'
  if (!puede) return sinPermiso
  return null
}

function Anular({ expediente: e }: { expediente: ExpedienteInfraccion }) {
  const puede = usePuede('anulacion_papeleta')
  const [abierto, setAbierto] = useState(false)
  const queryClient = useQueryClient()
  const motivo = impedimento(e.acciones.anulacion, puede, 'Sin permiso: anular pide creación sobre las anulaciones de papeleta.')
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" disabled={motivo !== null} onClick={() => setAbierto(true)}>
        <Ban className="size-4" />
        Anular
      </Button>
      {motivo && <p className="max-w-xs text-right text-xs text-ink-muted">{motivo}</p>}
      {abierto && (
        <DialogoAnular expediente={e} onExito={() => queryClient.invalidateQueries({ queryKey: claves.infracciones })} onCerrar={() => setAbierto(false)} />
      )}
    </div>
  )
}

function DialogoAnular({ expediente: e, onExito, onCerrar }: { expediente: ExpedienteInfraccion; onExito: () => unknown; onCerrar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState('')
  const campoMotivo = useId()
  const campoFecha = useId()
  return (
    <DialogoDeActo
      titulo={`Anular el acta ${e.acta.numero}`}
      descripcion="El acta queda anulada, con su motivo: no se borra, y su multa deja de estar pendiente."
      completo={motivo.trim() !== ''}
      porQue="Por qué se anula"
      accion="Anular"
      siFalla="No se pudo anular el acta"
      enviar={(observacion) => rentas.anularActa(e.acta.id, fecha ? { motivo: motivo.trim(), fecha, observacion } : { motivo: motivo.trim(), observacion })}
      onExito={onExito}
      onCerrar={onCerrar}
    >
      <div className="space-y-1">
        <Label htmlFor={campoMotivo}>Motivo</Label>
        <Textarea id={campoMotivo} rows={2} required maxLength={500} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={campoFecha}>Fecha de la anulación</Label>
        <Input id={campoFecha} type="date" max={today()} value={fecha} onChange={(ev) => setFecha(ev.target.value)} />
        <p className="text-xs text-ink-muted">En blanco: hoy.</p>
      </div>
    </DialogoDeActo>
  )
}
