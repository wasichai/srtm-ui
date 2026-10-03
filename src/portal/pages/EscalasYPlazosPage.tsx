import { EmptyState, QueryState } from '@wasichai/core'
import { Button, Card, CardBody, Input, Label, Pagination, Table, Td, Th } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { rentas } from '../api'
import { useSession } from '../auth/session'
import { BadgeDeMapa } from '../components/BadgeDeMapa'
import { formatDate, formatText, today } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { describirContribuyente } from '../forms/bloques'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import { useNotificacionesDe, useVencidas } from '../queries'
import type { NotificacionPrevia, NotificacionVencida, Pagina } from '../types'
import { VENCIDA, vencida } from './NotificacionesPage'
import { SubnavInfracciones } from './SubnavInfracciones'

// escalas y plazos: the padrones of the notificaciones previas (the vencidas without an acta at a corte, and a
// contribuyente's), and where the plazos and feriados the backend counts with are loaded. vencimiento, vencida and the
// corte are the backend's (one definition, SPEC §6): nothing here adds days to a date. there is no endpoint listing the
// plazos loaded for a year: the page says how they are configured, and an act that lacks one names it (`faltan`)

const plazo = (dias: number | null) => (dias === null ? 'Sin plazo' : `${dias} ${dias === 1 ? 'día' : 'días'}`)

// the admin's list of parametro_tributario (core's route under /admin)
const PARAMETROS_EN_ADMIN = '/admin/data/objects/parametro_tributario/records'

export function EscalasYPlazosPage() {
  return (
    <div className="space-y-5">
      <SubnavInfracciones />
      <div>
        <h1 className="text-xl font-semibold text-ink">Escalas y plazos</h1>
        <p className="text-sm text-ink-muted">
          Las notificaciones previas vencidas sin acta a una fecha de corte, las de un contribuyente, y dónde se cargan los plazos y feriados con que el sistema
          cuenta los días.
        </p>
      </div>
      <Vencidas />
      <PorContribuyente />
      <PlazosCargados />
    </div>
  )
}

function Vencidas() {
  const id = useId()
  const [borrador, setBorrador] = useState(today)
  const [corte, setCorte] = useState(today)
  const [page, setPage] = useState(0)
  const query = useVencidas(corte, page)
  const consultar = (event: FormEvent) => {
    event.preventDefault()
    setCorte(borrador || today())
    setPage(0)
  }
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Vencidas sin acta</h2>
          <p className="text-sm text-ink-muted">Las notificaciones no subsanadas y sin acta cuyo plazo venció a la fecha de corte.</p>
        </div>
        <form role="search" aria-label="Corte de las vencidas" onSubmit={consultar} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={id}>Fecha de corte</Label>
            <Input id={id} type="date" value={borrador} onChange={(e) => setBorrador(e.target.value)} />
          </div>
          <Button type="submit">
            <Search className="size-4" />
            Consultar
          </Button>
        </form>
        <QueryState query={query}>{(resultado) => <ListadoVencidas resultado={resultado} corte={corte} onPage={setPage} />}</QueryState>
      </CardBody>
    </Card>
  )
}

function ListadoVencidas({ resultado, corte, onPage }: { resultado: Pagina<NotificacionVencida>; corte: string; onPage: (page: number) => void }) {
  // the corte the backend applied: the one its rows carry, else the one asked
  const al = formatDate(resultado.content[0]?.corte ?? corte)
  if (resultado.content.length === 0) {
    return (
      <EmptyState title="Ninguna vencida">
        <p>Ninguna notificación previa vencida sin acta al {al}.</p>
      </EmptyState>
    )
  }
  return (
    <>
      <Table aria-label={`Vencidas sin acta al ${al}`}>
        <thead>
          <tr>
            <Th>Número</Th>
            <Th>Fecha</Th>
            <Th>Administrado</Th>
            <Th>Dirección</Th>
            <Th {...NUMERICA}>Plazo</Th>
            <Th>Vencimiento</Th>
          </tr>
        </thead>
        <tbody>
          {resultado.content.map((n) => (
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
              <Td {...NUMERICA}>{plazo(n.plazo_dias)}</Td>
              <Td className="whitespace-nowrap">{formatDate(n.vencimiento)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={onPage} />
    </>
  )
}

function PorContribuyente() {
  const [contribuyente, setContribuyente] = useState<Picked | null>(null)
  const [page, setPage] = useState(0)
  const query = useNotificacionesDe(contribuyente?.id, page)
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Por contribuyente</h2>
          <p className="text-sm text-ink-muted">Las notificaciones previas de un contribuyente, con su vencimiento, su subsanación y el acta que originaron.</p>
        </div>
        <div className="max-w-md">
          <RecordPicker
            label="Contribuyente"
            placeholder="DNI, RUC o nombre"
            value={contribuyente}
            onChange={(c) => {
              setContribuyente(c)
              setPage(0)
            }}
            onQuitar={() => setContribuyente(null)}
            search={(q) => rentas.contribuyentes(q, 0, 8)}
            describe={describirContribuyente}
          />
        </div>
        {contribuyente && (
          <QueryState query={query}>{(resultado) => <ListadoDe resultado={resultado} nombre={contribuyente.label} onPage={setPage} />}</QueryState>
        )}
      </CardBody>
    </Card>
  )
}

function ListadoDe({ resultado, nombre, onPage }: { resultado: Pagina<NotificacionPrevia>; nombre: string; onPage: (page: number) => void }) {
  if (resultado.content.length === 0) {
    return (
      <EmptyState title="Sin notificaciones">
        <p>{nombre} no tiene notificaciones previas.</p>
      </EmptyState>
    )
  }
  // the day the backend derived vencida at
  const al = formatDate(resultado.content[0].vencidas_a)
  return (
    <>
      <Table aria-label={`Notificaciones de ${nombre}, vencidas al ${al}`}>
        <thead>
          <tr>
            <Th>Número</Th>
            <Th>Fecha</Th>
            <Th>Motivo</Th>
            <Th {...NUMERICA}>Plazo</Th>
            <Th>Vencimiento</Th>
            <Th>Vencida al {al}</Th>
            <Th>Subsanada</Th>
            <Th>Acta</Th>
          </tr>
        </thead>
        <tbody>
          {resultado.content.map((n) => (
            <tr key={n.id}>
              <Td className="font-semibold">{n.numero}</Td>
              <Td className="whitespace-nowrap">{formatDate(n.fecha)}</Td>
              <Td>{n.motivo}</Td>
              <Td {...NUMERICA}>{plazo(n.plazo_dias)}</Td>
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
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={onPage} />
    </>
  )
}

// how the plazos and feriados are configured: there is no query of the ones loaded for a year, and none is invented
function PlazosCargados() {
  const { isAdmin } = useSession()
  return (
    <Card>
      <CardBody className="space-y-3 text-sm text-ink">
        <h2 className="text-base font-semibold text-ink">Plazos cargados</h2>
        <p>
          Los plazos y feriados no están en el código: son parámetros tributarios (<code>parametro_tributario</code>), cada uno con su vigencia, y el sistema
          toma el vigente a la fecha del acto.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>PLAZO</code> <code>DESCARGO_PAPELETA</code>: los días hábiles para presentar un descargo, contados desde la fecha de la infracción (valor
            numérico; texto <code>DIAS_HABILES</code>).
          </li>
          <li>
            <code>PLAZO</code> <code>RG_RECURSO</code>: los días hábiles para recurrir una resolución; también fija desde cuándo es exigible una resolución
            notificada.
          </li>
          <li>
            <code>FERIADOS</code> <code>&lt;año&gt;</code>: los feriados del año que no son nacionales (fechas separadas por coma), vigente del 1 de enero al 31
            de diciembre. Se suman a los nacionales.
          </li>
        </ul>
        <p>
          Si al año le falta uno, el acto que lo necesita no se registra y una alerta nombra lo que falta (por ejemplo <code>PLAZO DESCARGO_PAPELETA</code> o{' '}
          <code>FERIADOS</code> con su año). Las escalas de las multas (el % de la UIT por grado de reincidencia) están en el{' '}
          <Link to="/infracciones/cuis" className="text-link hover:underline">
            CUIS
          </Link>
          .
        </p>
        <p>
          Se cargan con el importador de parámetros de srtm-backend (<code>import_parametros.py</code>)
          {isAdmin ? (
            <>
              {' '}
              o en la{' '}
              <a href={PARAMETROS_EN_ADMIN} className="text-link hover:underline">
                lista de parámetros tributarios de la administración
              </a>
            </>
          ) : (
            ' o en la administración (rol ADMIN)'
          )}
          .
        </p>
      </CardBody>
    </Card>
  )
}
