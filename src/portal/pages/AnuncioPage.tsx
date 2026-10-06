import { useQueryClient } from '@tanstack/react-query'
import { QueryState } from '@wasichai/core'
import { Alert, Badge, Button, Card, CardBody, Input, Table, Td, Textarea, Th } from '@wasichai/ui'
import { Ban, CalendarClock, Coins, RefreshCw, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { rentas } from '../api'
import { DialogoDeActo } from '../components/DialogoDeActo'
import { EstadoAnuncioBadge } from '../components/EstadoAnuncioBadge'
import { formatDate, formatMoney, formatNumber, formatText } from '../components/format'
import { usePuede } from '../components/permisos'
import { StatCard } from '../components/StatCard'
import { NUMERICA } from '../components/tabla'
import { claves, useAnuncio } from '../queries'
import type { AccionPermitida, AccionesAnuncio, EstadoAnuncio, FichaAnuncio, MovimientoAnuncio } from '../types'
import { Campo } from './AnunciosPages'
import { CLASES_ANUNCIO, etiqueta, MOVIMIENTOS_ANUNCIO, terminoDeVigencia, TIPOS_ANUNCIO, vigenciaAlDia } from './etiquetasAnuncio'
import { FichaHeader } from './FichaHeader'
import { SubnavAnuncios } from './SubnavAnuncios'

// an anuncio's ficha: its data, its acts in order (append only) and the three acts left to it. the estado, the vigencia
// in force and the tasas accrued are the backend's at al_dia, never computed here from the dates. an act the estado
// does not admit, or the account may not write, is shown impeded with why

export function AnuncioRoute() {
  const { id = '' } = useParams()
  return <AnuncioPage key={id} id={id} />
}

type Acto = 'renovacion' | 'cese' | 'retiro'

// why the backend's estado at al_dia does not admit an act (null: it does). the backend may say it itself
// (`acciones`), and it decides all the same: this only keeps the clerk from a refusal it already knows of
const IMPEDIDO_POR_ESTADO: Record<Acto, Partial<Record<EstadoAnuncio, string>>> = {
  renovacion: {
    CESADO: 'Un anuncio cesado no se renueva.',
    RETIRADO: 'Un anuncio retirado no se renueva.'
  },
  cese: {
    CESADO: 'El anuncio ya está cesado.',
    RETIRADO: 'El anuncio ya está retirado.'
  },
  retiro: {
    VIGENTE: 'Se retira después del cese: el anuncio no está cesado.',
    VENCIDO: 'Se retira después del cese: el anuncio no está cesado.',
    RETIRADO: 'El anuncio ya está retirado.'
  }
}

function accionDe(ficha: FichaAnuncio, acto: Acto): AccionPermitida {
  const delBackend: AccionPermitida | undefined = ficha.acciones?.[acto as keyof AccionesAnuncio]
  if (delBackend) return delBackend
  const motivo = IMPEDIDO_POR_ESTADO[acto][ficha.estado] ?? null
  return { permitida: motivo === null, motivo }
}

function AnuncioPage({ id }: { id: string }) {
  const query = useAnuncio(id)
  return (
    <div className="space-y-5">
      <SubnavAnuncios />
      <QueryState query={query}>{(ficha) => <Ficha ficha={ficha} />}</QueryState>
    </div>
  )
}

function Ficha({ ficha }: { ficha: FichaAnuncio }) {
  const { anuncio: a, al_dia, devengado } = ficha
  const puede = usePuede('movimiento_anuncio')
  const [dialogo, setDialogo] = useState<Acto | null>(null)
  const al = formatDate(al_dia)

  return (
    <div className="space-y-5">
      <FichaHeader
        kind="Anuncio"
        title={`${a.numero} · ${a.denominacion ?? etiqueta(CLASES_ANUNCIO, a.clase)}`}
        badges={
          <>
            <Badge>{etiqueta(CLASES_ANUNCIO, a.clase)}</Badge>
            <span>{etiqueta(TIPOS_ANUNCIO, a.tipo)}</span>
            <span>· {a.direccion}</span>
          </>
        }
        aside={
          <span className="flex items-center gap-2 text-sm text-ink-muted" data-testid="estado-anuncio">
            Al {al}: <EstadoAnuncioBadge estado={ficha.estado} />
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={CalendarClock}
          label={`Vigente hasta (al ${al})`}
          value={vigenciaAlDia(ficha)}
          nota={terminoDeVigencia(ficha.estado, ficha.movimientos) ?? undefined}
        />
        <StatCard icon={Coins} label={`Devengado al ${formatDate(devengado.al_dia)}`} value={formatMoney(devengado.importe)} />
      </div>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold">Actos</h2>
          <div className="flex flex-wrap items-start gap-6">
            <BotonDeActo acto="renovacion" etiqueta="Renovar" icono={RefreshCw} ficha={ficha} puede={puede} onAbrir={setDialogo} />
            <BotonDeActo acto="cese" etiqueta="Cesar" icono={Ban} ficha={ficha} puede={puede} onAbrir={setDialogo} />
            <BotonDeActo acto="retiro" etiqueta="Retirar" icono={Trash2} ficha={ficha} puede={puede} onAbrir={setDialogo} />
          </div>
          {!puede && <p className="text-xs text-ink-muted">Sin permiso: renovar, cesar o retirar pide creación sobre los movimientos de anuncio.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold">Datos del anuncio</h2>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <Dato nombre="Número">{a.numero}</Dato>
            <Dato nombre="Titular">
              <Link to={`/contribuyentes/${a.contribuyente}?tab=anuncios`} className="text-link hover:underline">
                Ver contribuyente
              </Link>
            </Dato>
            <Dato nombre="Predio">
              {a.predio ? (
                <Link to={`/predios/${a.predio}?tab=anuncios`} className="text-link hover:underline">
                  Ver predio
                </Link>
              ) : (
                '—'
              )}
            </Dato>
            <Dato nombre="Clase">{etiqueta(CLASES_ANUNCIO, a.clase)}</Dato>
            <Dato nombre="Tipo">{etiqueta(TIPOS_ANUNCIO, a.tipo)}</Dato>
            <Dato nombre="Emplazamiento">{formatText(a.emplazamiento)}</Dato>
            <Dato nombre="Forma">{formatText(a.forma)}</Dato>
            <Dato nombre="Denominación">{formatText(a.denominacion)}</Dato>
            <Dato nombre="Dirección">{a.direccion}</Dato>
            <Dato nombre="Área">{`${formatNumber(a.area)} m²`}</Dato>
            <Dato nombre="Lados">{formatNumber(a.lados)}</Dato>
            <Dato nombre="Cantidad">{formatNumber(a.cantidad)}</Dato>
            <Dato nombre="Autorizado el">{formatDate(a.fecha_autorizacion)}</Dato>
            <Dato nombre="Vigencia autorizada">{a.vigencia_hasta ? `hasta el ${formatDate(a.vigencia_hasta)}` : 'Sin plazo'}</Dato>
            <Dato nombre="Expediente">{a.expediente ? `${a.expediente}${a.fecha_expediente ? ` (${formatDate(a.fecha_expediente)})` : ''}` : '—'}</Dato>
            <Dato nombre="Licencia">{formatText(a.licencia_texto)}</Dato>
            <Dato nombre="Observación">{a.observacion}</Dato>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold">Movimientos</h2>
          <Movimientos movimientos={ficha.movimientos} />
        </CardBody>
      </Card>

      {dialogo && <DialogoAnuncio acto={dialogo} ficha={ficha} onCerrar={() => setDialogo(null)} />}
    </div>
  )
}

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{nombre}</dt>
      <dd>{children}</dd>
    </>
  )
}

function BotonDeActo({
  acto,
  etiqueta: texto,
  icono: Icono,
  ficha,
  puede,
  onAbrir
}: {
  acto: Acto
  etiqueta: string
  icono: typeof RefreshCw
  ficha: FichaAnuncio
  puede: boolean
  onAbrir: (acto: Acto) => void
}) {
  const accion = accionDe(ficha, acto)
  return (
    <div className="flex max-w-64 flex-col items-start gap-1">
      <Button variant="secondary" disabled={!puede || !accion.permitida} onClick={() => onAbrir(acto)}>
        <Icono className="size-4" />
        {texto}
      </Button>
      {!accion.permitida && accion.motivo && <p className="text-xs text-ink-muted">{accion.motivo}</p>}
    </div>
  )
}

function Movimientos({ movimientos }: { movimientos: MovimientoAnuncio[] }) {
  if (movimientos.length === 0) return <p className="text-sm text-ink-muted">Sin movimientos.</p>
  return (
    <Table aria-label="Movimientos del anuncio">
      <thead>
        <tr>
          <Th>Acto</Th>
          <Th>Fecha</Th>
          <Th {...NUMERICA}>Ejercicio</Th>
          <Th>Referencia de cargo</Th>
          <Th {...NUMERICA}>Tasa</Th>
          <Th>Vigente hasta</Th>
          <Th>Motivo</Th>
          <Th>Observación</Th>
        </tr>
      </thead>
      <tbody>
        {movimientos.map((m) => (
          <tr key={m.id}>
            <Td>{etiqueta(MOVIMIENTOS_ANUNCIO, m.tipo)}</Td>
            <Td className="whitespace-nowrap">{formatDate(m.fecha)}</Td>
            <Td {...NUMERICA}>{m.anio ?? '—'}</Td>
            <Td className="whitespace-nowrap">{formatText(m.referencia_cargo)}</Td>
            <Td {...NUMERICA}>
              {m.tasa === null ? (
                '—'
              ) : (
                <>
                  {formatMoney(m.tasa)}
                  <span className="block text-xs text-ink-muted">al {formatDate(m.fecha)}</span>
                </>
              )}
            </Td>
            <Td className="whitespace-nowrap">{m.vigencia_hasta ? formatDate(m.vigencia_hasta) : '—'}</Td>
            <Td>{formatText(m.motivo)}</Td>
            <Td>{m.observacion}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

const TITULOS: Record<Acto, { titulo: string; accion: string; porQue: string; siFalla: string; hecho: string }> = {
  renovacion: { titulo: 'Renovar el anuncio', accion: 'Renovar', porQue: 'Por qué se renueva', siFalla: 'No se pudo renovar', hecho: 'Renovación registrada' },
  cese: { titulo: 'Cesar el anuncio', accion: 'Cesar', porQue: 'Por qué se cesa', siFalla: 'No se pudo cesar', hecho: 'Cese registrado' },
  retiro: { titulo: 'Retirar el anuncio', accion: 'Retirar', porQue: 'Por qué se retira', siFalla: 'No se pudo retirar', hecho: 'Retiro registrado' }
}

// one act: a renovación (fecha and new vigencia, both optional: the backend takes today and the ejercicio it renews),
// or a cese or retiro (fecha optional, motivo required). the backend writes it or says why not
function DialogoAnuncio({ acto, ficha, onCerrar }: { acto: Acto; ficha: FichaAnuncio; onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const id = ficha.anuncio.id
  const [fecha, setFecha] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [motivo, setMotivo] = useState('')
  const textos = TITULOS[acto]
  const conMotivo = acto !== 'renovacion'
  const largoMotivo = motivo.trim().length

  const enviar = (observacion: string) => {
    const conFecha = fecha ? { fecha } : {}
    if (acto === 'renovacion') return rentas.renovarAnuncio(id, { ...conFecha, vigencia_hasta: vigencia || null, observacion })
    const cuerpo = { ...conFecha, motivo: motivo.trim(), observacion }
    return acto === 'cese' ? rentas.cesarAnuncio(id, cuerpo) : rentas.retirarAnuncio(id, cuerpo)
  }

  return (
    <DialogoDeActo<MovimientoAnuncio>
      titulo={`${textos.titulo} ${ficha.anuncio.numero}`}
      descripcion={
        acto === 'renovacion'
          ? 'Devenga la tasa de su clase del ejercicio que renueva, vigente al 1 de enero de ese año. Un ejercicio se devenga una sola vez.'
          : acto === 'cese'
            ? 'El anuncio deja de estar vigente desde esa fecha. No se renueva después.'
            : 'El retiro va después del cese y cierra el anuncio.'
      }
      completo={!conMotivo || (largoMotivo > 0 && largoMotivo <= 500)}
      porQue={textos.porQue}
      accion={textos.accion}
      siFalla={textos.siFalla}
      enviar={enviar}
      onExito={() => queryClient.invalidateQueries({ queryKey: claves.anuncios })}
      exito={(m) => (
        <Alert tone="success">
          {textos.hecho}
          {m.fecha ? ` el ${formatDate(m.fecha)}` : ''}.
          {m.tasa !== null && m.tasa !== undefined && ` Devenga ${formatMoney(m.tasa)} del ejercicio ${m.anio ?? '—'}.`}
        </Alert>
      )}
      onCerrar={onCerrar}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha del acto">{(campo) => <Input id={campo} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />}</Campo>
        {acto === 'renovacion' && (
          <Campo etiqueta="Nueva vigencia hasta">
            {(campo) => <Input id={campo} type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />}
          </Campo>
        )}
      </div>
      <p className="text-xs text-ink-muted">Sin fecha, la de hoy.</p>
      {conMotivo && (
        <Campo etiqueta="Motivo">
          {(campo) => <Textarea id={campo} rows={2} maxLength={550} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
      )}
    </DialogoDeActo>
  )
}
