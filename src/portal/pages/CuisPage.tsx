import { useQueryClient } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Button, Card, CardBody, Input, Label, Table, Td, Textarea, Th } from '@wasichai/ui'
import { FilePlus, Search } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { DialogoDeActo } from '../components/DialogoDeActo'
import { formatDate, formatMoney, formatNumber, formatText, today } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { usePuede } from '../components/permisos'
import { claves, useCuis } from '../queries'
import type { CatalogoCuis, CodigoInfraccion, Cuis, FiltrosCuis, NuevaVersionCuis, VersionCuisCreada } from '../types'
import { SubnavInfracciones } from './SubnavInfracciones'

// the CUIS (cuadro único de infracciones y sanciones) in force on a day, with each code's multa at that day's UIT, as
// the backend computes it: nothing here multiplies a UIT by a %. without a UIT the multas say why, never a 0. a code is
// never edited: a new version (with CREATE on codigo_infraccion) closes the one in force

const vigencia = (c: CodigoInfraccion) => `${formatDate(c.vigencia_desde)} – ${c.vigencia_hasta ? formatDate(c.vigencia_hasta) : 'en adelante'}`
// the "Multa S/" column carries the currency: its cells are the bare amount, with its two decimals
const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const porcentaje = (valor: number | null) => (valor === null ? '—' : `${formatNumber(valor)} %`)

// an amount of the backend, or why there is none: no UIT that day, or no % for that grade in the CUIS
function Multa({ valor, porcentajeFijado, sinUit }: { valor: number | null; porcentajeFijado: boolean; sinUit: boolean }) {
  if (valor !== null) return <>{soles.format(valor)}</>
  const motivo = !porcentajeFijado ? 'El CUIS no fija el % de esta vez' : sinUit ? 'Sin UIT a la fecha' : 'Sin multa calculada'
  return (
    <span title={motivo} className="text-ink-muted">
      —<span className="sr-only"> {motivo}</span>
    </span>
  )
}

export function CuisPage() {
  const [filtros, setFiltros] = useState<FiltrosCuis>(() => ({ vigentes_a: today() }))
  const [borrador, setBorrador] = useState({ vigentes_a: today(), materia: '', q: '' })
  const query = useCuis(filtros)
  const puede = usePuede('codigo_infraccion')
  // the dialog: a blank one (a new code) or a version of a code
  const [dialogo, setDialogo] = useState<{ base: CodigoInfraccion | null } | null>(null)

  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setFiltros({ vigentes_a: borrador.vigentes_a || today(), materia: borrador.materia.trim() || undefined, q: borrador.q.trim() || undefined })
  }

  return (
    <div className="space-y-5">
      <SubnavInfracciones />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">CUIS</h1>
          <p className="text-sm text-ink-muted">
            El cuadro único de infracciones y sanciones vigente a una fecha, con la multa de cada código a la UIT de ese día.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="secondary" disabled={!puede} onClick={() => setDialogo({ base: null })}>
            <FilePlus className="size-4" />
            Nuevo código
          </Button>
          {!puede && <p className="text-xs text-ink-muted">Sin permiso: una versión del CUIS pide creación sobre los códigos de infracción.</p>}
        </div>
      </div>

      <Card>
        <CardBody>
          <form role="search" aria-label="Filtros del CUIS" onSubmit={buscar} className="flex flex-wrap items-end gap-4">
            <Campo etiqueta="Vigentes al">
              {(id) => (
                <Input id={id} type="date" required value={borrador.vigentes_a} onChange={(e) => setBorrador({ ...borrador, vigentes_a: e.target.value })} />
              )}
            </Campo>
            <Campo etiqueta="Materia">
              {(id) => <Input id={id} value={borrador.materia} onChange={(e) => setBorrador({ ...borrador, materia: e.target.value })} />}
            </Campo>
            <Campo etiqueta="Código o descripción">
              {(id) => <Input id={id} type="search" value={borrador.q} onChange={(e) => setBorrador({ ...borrador, q: e.target.value })} />}
            </Campo>
            <Button type="submit">
              <Search className="size-4" />
              Buscar
            </Button>
          </form>
        </CardBody>
      </Card>

      <QueryState query={query}>{(catalogo) => <Catalogo catalogo={catalogo} puede={puede} onVersion={(base) => setDialogo({ base })} />}</QueryState>

      {dialogo && <DialogoVersion base={dialogo.base} onCerrar={() => setDialogo(null)} />}
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

function Catalogo({ catalogo, puede, onVersion }: { catalogo: CatalogoCuis; puede: boolean; onVersion: (base: CodigoInfraccion) => void }) {
  const al = formatDate(catalogo.vigentes_a)
  const sinUit = catalogo.uit === null
  return (
    <div className="space-y-3">
      {catalogo.uit && (
        <p className="text-sm text-ink" data-testid="uit-aplicada">
          Multas a la UIT {catalogo.uit.anio} ({formatMoney(catalogo.uit.valor)}), vigente al {al}.
        </p>
      )}
      {catalogo.faltan.length > 0 && (
        <Alerta tono="atencion" titulo={`Al ${al} falta:`}>
          {catalogo.faltan.join('; ')}. Sin eso no se cifran las multas.
        </Alerta>
      )}
      <Card>
        {catalogo.codigos.length === 0 ? (
          <EmptyState title={`Ningún código vigente al ${al}`}>
            <p>Cambie la fecha o los filtros, o cargue el CUIS.</p>
          </EmptyState>
        ) : (
          <Table aria-label={`CUIS vigente al ${al}`}>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Infracción</Th>
                <Th {...NUMERICA}>% UIT</Th>
                <Th {...NUMERICA}>Multa S/</Th>
                <Th {...NUMERICA}>2ª vez</Th>
                <Th {...NUMERICA}>3ª vez</Th>
                <Th>Medida</Th>
                <Th>Vigencia</Th>
                <Th>Base legal</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {catalogo.codigos.map((c: Cuis) => (
                <tr key={c.id}>
                  <Td className="font-semibold">{c.codigo}</Td>
                  <Td>
                    {c.descripcion}
                    {c.materia && <span className="block text-xs text-ink-muted">{c.materia}</span>}
                  </Td>
                  <Td {...NUMERICA}>{porcentaje(c.porcentaje_uit)}</Td>
                  <Td {...NUMERICA}>
                    <Multa valor={c.multa} porcentajeFijado sinUit={sinUit} />
                  </Td>
                  <Td {...NUMERICA}>
                    <Multa valor={c.multa_segunda} porcentajeFijado={c.porcentaje_uit_segunda !== null} sinUit={sinUit} />
                  </Td>
                  <Td {...NUMERICA}>
                    <Multa valor={c.multa_tercera} porcentajeFijado={c.porcentaje_uit_tercera !== null} sinUit={sinUit} />
                  </Td>
                  <Td>{formatText(c.medida_complementaria)}</Td>
                  <Td className="whitespace-nowrap">{vigencia(c)}</Td>
                  <Td>{c.base_legal}</Td>
                  <Td>
                    <Button variant="secondary" disabled={!puede} onClick={() => onVersion(c)} aria-label={`Nueva versión de ${c.codigo}`}>
                      Nueva versión
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}

interface Borrador {
  codigo: string
  descripcion: string
  materia: string
  porcentaje_uit: string
  porcentaje_uit_segunda: string
  porcentaje_uit_tercera: string
  medida_complementaria: string
  base_legal: string
  vigencia_desde: string
}

const texto = (valor: number | null) => (valor === null ? '' : String(valor))
const numero = (valor: string) => (valor.trim() === '' ? null : Number(valor))
const opcional = (valor: string) => valor.trim() || null

// a version of a code: the one in force copied to start with, from a day after it began; the backend closes it
function DialogoVersion({ base, onCerrar }: { base: CodigoInfraccion | null; onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const [b, setB] = useState<Borrador>(() => ({
    codigo: base?.codigo ?? '',
    descripcion: base?.descripcion ?? '',
    materia: base?.materia ?? '',
    porcentaje_uit: base ? texto(base.porcentaje_uit) : '',
    porcentaje_uit_segunda: base ? texto(base.porcentaje_uit_segunda) : '',
    porcentaje_uit_tercera: base ? texto(base.porcentaje_uit_tercera) : '',
    medida_complementaria: base?.medida_complementaria ?? '',
    base_legal: base?.base_legal ?? '',
    vigencia_desde: ''
  }))
  const campo = (nombre: keyof Borrador) => ({ value: b[nombre], onChange: (e: { target: { value: string } }) => setB({ ...b, [nombre]: e.target.value }) })
  const porcentajes = [b.porcentaje_uit, b.porcentaje_uit_segunda, b.porcentaje_uit_tercera].map(numero)
  const completo =
    b.codigo.trim() !== '' &&
    b.descripcion.trim() !== '' &&
    b.base_legal.trim() !== '' &&
    b.vigencia_desde !== '' &&
    porcentajes[0] !== null &&
    porcentajes.every((p) => p === null || Number.isFinite(p))

  const cuerpo = (observacion: string): NuevaVersionCuis => ({
    familia: base?.familia ?? 'ADMINISTRATIVA',
    codigo: b.codigo.trim(),
    descripcion: b.descripcion.trim(),
    materia: opcional(b.materia),
    porcentaje_uit: porcentajes[0] as number,
    porcentaje_uit_segunda: porcentajes[1],
    porcentaje_uit_tercera: porcentajes[2],
    medida_complementaria: opcional(b.medida_complementaria),
    base_legal: b.base_legal.trim(),
    vigencia_desde: b.vigencia_desde,
    observacion
  })

  return (
    <DialogoDeActo<VersionCuisCreada>
      titulo={base ? `Nueva versión de ${base.codigo}` : 'Nuevo código del CUIS'}
      descripcion={
        base
          ? `La versión vigente desde el ${formatDate(base.vigencia_desde)} se cierra el día anterior al que empiece esta. Ninguna se edita después.`
          : 'Si el código ya tiene una versión vigente, esta la cierra el día anterior al que empiece. Ninguna se edita después.'
      }
      completo={completo}
      porQue="Por qué se versiona"
      accion="Crear versión"
      siFalla="No se pudo crear la versión"
      enviar={(observacion) => rentas.crearVersionCuis(cuerpo(observacion))}
      onExito={() => queryClient.invalidateQueries({ queryKey: claves.infracciones })}
      exito={(creada) => (
        <Alerta tono="exito">
          Versión de {creada.codigo} vigente desde el {formatDate(creada.vigencia_desde)}.
          {creada.cerrada
            ? ` Se cerró la anterior (desde el ${formatDate(creada.cerrada.vigencia_desde)}): vigente hasta el ${formatDate(creada.cerrada.vigencia_hasta)}.`
            : ' No había otra vigente.'}
        </Alerta>
      )}
      onCerrar={onCerrar}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Código">{(id) => <Input id={id} required readOnly={base !== null} {...campo('codigo')} />}</Campo>
        <Campo etiqueta="Vigente desde">{(id) => <Input id={id} type="date" required {...campo('vigencia_desde')} />}</Campo>
      </div>
      <Campo etiqueta="Descripción">{(id) => <Textarea id={id} rows={2} required {...campo('descripcion')} />}</Campo>
      <Campo etiqueta="Materia">{(id) => <Input id={id} {...campo('materia')} />}</Campo>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="% UIT">{(id) => <Input id={id} type="number" step="0.01" min="0" required {...campo('porcentaje_uit')} />}</Campo>
        <Campo etiqueta="% UIT 2ª vez">{(id) => <Input id={id} type="number" step="0.01" min="0" {...campo('porcentaje_uit_segunda')} />}</Campo>
        <Campo etiqueta="% UIT 3ª vez">{(id) => <Input id={id} type="number" step="0.01" min="0" {...campo('porcentaje_uit_tercera')} />}</Campo>
      </div>
      <Campo etiqueta="Medida complementaria">{(id) => <Input id={id} {...campo('medida_complementaria')} />}</Campo>
      <Campo etiqueta="Base legal">{(id) => <Input id={id} required {...campo('base_legal')} />}</Campo>
    </DialogoDeActo>
  )
}
