import { EmptyState, QueryState } from '@wasichai/core'
import { Button, Card, CardBody, Input, Label, Pagination, Table, Td, Th } from '@wasichai/ui'
import { FilePlus, Search } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { porcentaje } from '../components/DesgloseMulta'
import { EstadoDeudaBadge } from '../components/EstadoDeudaBadge'
import { FASES, FaseBadge } from '../components/FaseBadge'
import { formatDate, formatMoney, formatText, today } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { usePuede } from '../components/permisos'
import { useActas } from '../queries'
import type { FaseProcedimiento, FiltrosActas, Pagina, Procedimiento } from '../types'
import { PanelInfracciones } from './PanelInfracciones'
import { SubnavInfracciones } from './SubnavInfracciones'

// the expedientes: every acta with its multa as frozen on fecha_calculo, where its procedure stands at fase_al_dia and
// its estado de la deuda, both the backend's (SPEC §6): nothing here decides a fase. the fase and the estado are two
// columns with their own names, never one in place of the other. a row opens the expediente's ficha. the year's panel
// heads the page

interface Borrador {
  numero: string
  administrado: string
  codigo: string
  fase: FaseProcedimiento | ''
  desde: string
  hasta: string
}

const VACIO: Borrador = { numero: '', administrado: '', codigo: '', fase: '', desde: '', hasta: '' }

export function ExpedientesPage() {
  const [filtros, setFiltros] = useState<FiltrosActas>({})
  const [borrador, setBorrador] = useState<Borrador>(VACIO)
  const [page, setPage] = useState(0)
  const query = useActas(filtros, page)
  const puede = usePuede('papeleta')
  const navigate = useNavigate()

  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setFiltros({
      numero: borrador.numero.trim() || undefined,
      administrado: borrador.administrado.trim() || undefined,
      codigo: borrador.codigo.trim() || undefined,
      fase: borrador.fase || undefined,
      desde: borrador.desde || undefined,
      hasta: borrador.hasta || undefined
    })
    setPage(0)
  }
  const texto = (nombre: 'numero' | 'administrado' | 'codigo' | 'desde' | 'hasta') => ({
    value: borrador[nombre],
    onChange: (e: { target: { value: string } }) => setBorrador({ ...borrador, [nombre]: e.target.value })
  })

  return (
    <div className="space-y-5">
      <SubnavInfracciones />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Expedientes</h1>
          <p className="text-sm text-ink-muted">
            Las actas de constatación con su multa, la fase del procedimiento y el estado de la deuda, tal como los dice el sistema a la fecha indicada.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="secondary" disabled={!puede} onClick={() => navigate('/infracciones/nueva')}>
            <FilePlus className="size-4" />
            Nueva acta
          </Button>
          {!puede && <p className="text-xs text-ink-muted">Sin permiso: registrar un acta pide creación sobre las papeletas.</p>}
        </div>
      </div>

      <PanelInfracciones />

      <Card>
        <CardBody>
          <form role="search" aria-label="Filtros de los expedientes" onSubmit={buscar} className="flex flex-wrap items-end gap-4">
            <Campo etiqueta="Número de acta">{(id) => <Input id={id} {...texto('numero')} />}</Campo>
            <Campo etiqueta="Administrado">{(id) => <Input id={id} placeholder="Documento o nombre" {...texto('administrado')} />}</Campo>
            <Campo etiqueta="Código CUIS">{(id) => <Input id={id} {...texto('codigo')} />}</Campo>
            <Campo etiqueta="Fase">
              {(id) => (
                <select
                  id={id}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                  value={borrador.fase}
                  onChange={(e) => setBorrador({ ...borrador, fase: e.target.value as FaseProcedimiento | '' })}
                >
                  <option value="">Todas</option>
                  {(Object.keys(FASES) as FaseProcedimiento[]).map((fase) => (
                    <option key={fase} value={fase}>
                      {FASES[fase].texto}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta="Desde">{(id) => <Input id={id} type="date" {...texto('desde')} />}</Campo>
            <Campo etiqueta="Hasta">{(id) => <Input id={id} type="date" {...texto('hasta')} />}</Campo>
            <Button type="submit">
              <Search className="size-4" />
              Buscar
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <QueryState query={query}>{(resultado) => <Listado resultado={resultado} onPage={setPage} />}</QueryState>
      </Card>
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

function Listado({ resultado, onPage }: { resultado: Pagina<Procedimiento>; onPage: (page: number) => void }) {
  const navigate = useNavigate()
  // the day the backend put the fases at: the one its rows carry (today)
  const al = formatDate(resultado.content[0]?.fase_al_dia ?? today())
  if (resultado.content.length === 0) {
    return (
      <EmptyState title="Ningún expediente">
        <p>Cambie los filtros, o registre un acta con «Nueva acta».</p>
      </EmptyState>
    )
  }
  return (
    <>
      <Table aria-label={`Expedientes, fase al ${al}`}>
        <thead>
          <tr>
            <Th>Número</Th>
            <Th>Fecha</Th>
            <Th>Administrado</Th>
            <Th>Código</Th>
            <Th {...NUMERICA}>% infracción</Th>
            <Th {...NUMERICA}>Importe a pagar</Th>
            <Th>Medida</Th>
            <Th>Fase al {al}</Th>
            <Th>Estado de la deuda</Th>
          </tr>
        </thead>
        <tbody>
          {resultado.content.map((p) => (
            <tr key={p.id} className="cursor-pointer hover:bg-surface-muted/60" onClick={() => navigate(`/infracciones/${p.id}`)}>
              <Td className="font-semibold whitespace-nowrap">
                <Link to={`/infracciones/${p.id}`} className="text-link hover:underline" onClick={(e) => e.stopPropagation()}>
                  {p.numero}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{formatDate(p.fecha_infraccion)}</Td>
              <Td>
                {formatText(p.administrado)}
                {p.documento && <span className="block text-xs text-ink-muted">{p.documento}</span>}
              </Td>
              <Td>
                <span className="font-medium">{p.codigo}</span>
                {p.descripcion_infraccion && <span className="block text-xs text-ink-muted">{p.descripcion_infraccion}</span>}
              </Td>
              <Td {...NUMERICA}>{porcentaje(p.porcentaje_infraccion)}</Td>
              <Td {...NUMERICA}>
                {formatMoney(p.importe_a_pagar)}
                <span className="block text-xs text-ink-muted">al {formatDate(p.fecha_calculo)}</span>
              </Td>
              <Td>{formatText(p.medida_complementaria)}</Td>
              <Td>
                <FaseBadge fase={p.fase} />
              </Td>
              <Td>
                <EstadoDeudaBadge estado={p.estado_de_la_deuda} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={onPage} />
    </>
  )
}
