import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, CardBody, Input, Textarea } from '@wasichai/ui'
import { FilePlus, Loader2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { rentas, RentasError } from '../api'
import { MensajeDeError, OBSERVACION_MAXIMA, OBSERVACION_MINIMA } from '../components/DialogoDeActo'
import { formatDate, formatMoney, today } from '../components/format'
import { usePuede } from '../components/permisos'
import { describirContribuyente } from '../forms/bloques'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import { claves } from '../queries'
import type { AnuncioRegistrado, ClaseAnuncio, NuevoAnuncio, Predio, TipoAnuncio } from '../types'
import { Campo } from './AnunciosPages'
import { CLASES_ANUNCIO, TIPOS_ANUNCIO } from './etiquetasAnuncio'
import { SubnavAnuncios } from './SubnavAnuncios'

// a new anuncio and its autorización (SPEC §7, Anuncios): the backend numbers it (AN-AAAA-NNNNNN), reads the clase's
// tasa and accrues it. no tasa is ever sent from here. each attempt to register carries one Idempotency-Key, kept
// across the retries of that same attempt (a lost answer, a 5xx): a resubmission answers the first anuncio (200,
// ya_existia) and accrues nothing again. a new key only once one is registered and the clerk starts another

const describirPredio = (p: Predio): Picked => ({ id: p.id!, label: `${p.codigo ?? 's/c'} · ${p.direccion ?? ''}` })

interface Borrador {
  clase: ClaseAnuncio | ''
  tipo: TipoAnuncio | ''
  emplazamiento: string
  forma: string
  denominacion: string
  direccion: string
  area: string
  lados: string
  cantidad: string
  fecha_autorizacion: string
  vigencia_hasta: string
  expediente: string
  fecha_expediente: string
  licencia_texto: string
  observacion: string
}

const vacio = (): Borrador => ({
  clase: '',
  tipo: '',
  emplazamiento: '',
  forma: '',
  denominacion: '',
  direccion: '',
  area: '',
  lados: '1',
  cantidad: '1',
  fecha_autorizacion: today(),
  vigencia_hasta: '',
  expediente: '',
  fecha_expediente: '',
  licencia_texto: '',
  observacion: ''
})

const opcional = (valor: string) => valor.trim() || null
const entero = (valor: string) => (valor.trim() === '' ? undefined : Number(valor))

const SELECT = 'h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink'

export function NuevoAnuncioPage() {
  const queryClient = useQueryClient()
  const puede = usePuede('anuncio')
  const [titular, setTitular] = useState<Picked | null>(null)
  const [predio, setPredio] = useState<Picked | null>(null)
  const [b, setB] = useState<Borrador>(vacio)
  // this attempt's Idempotency-Key: born on its first submission, the same on every retry until it is registered
  const clave = useRef<string | null>(null)
  const registro = useMutation({
    mutationFn: (cuerpo: NuevoAnuncio) => {
      clave.current ??= crypto.randomUUID()
      return rentas.registrarAnuncio(cuerpo, clave.current)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.anuncios })
  })

  const campo = (nombre: keyof Borrador) => ({ value: b[nombre], onChange: (e: { target: { value: string } }) => setB({ ...b, [nombre]: e.target.value }) })
  const area = Number(b.area)
  const largo = b.observacion.trim().length
  const completo =
    titular !== null &&
    b.clase !== '' &&
    b.tipo !== '' &&
    b.direccion.trim() !== '' &&
    b.area.trim() !== '' &&
    Number.isFinite(area) &&
    area > 0 &&
    largo >= OBSERVACION_MINIMA &&
    largo <= OBSERVACION_MAXIMA

  const registrar = (event: FormEvent) => {
    event.preventDefault()
    if (!completo || !puede || registro.isPending) return
    registro.mutate({
      contribuyente: titular!.id,
      predio: predio?.id ?? null,
      clase: b.clase as ClaseAnuncio,
      tipo: b.tipo as TipoAnuncio,
      emplazamiento: opcional(b.emplazamiento),
      forma: opcional(b.forma),
      denominacion: opcional(b.denominacion),
      direccion: b.direccion.trim(),
      area,
      lados: entero(b.lados),
      cantidad: entero(b.cantidad),
      fecha_autorizacion: b.fecha_autorizacion || undefined,
      vigencia_hasta: b.vigencia_hasta || null,
      expediente: opcional(b.expediente),
      fecha_expediente: b.fecha_expediente || null,
      licencia_texto: opcional(b.licencia_texto),
      observacion: b.observacion.trim()
    })
  }

  // another anuncio: a blank form and, on its first submission, a new key
  const otro = () => {
    clave.current = null
    registro.reset()
    setTitular(null)
    setPredio(null)
    setB(vacio())
  }

  return (
    <div className="space-y-5">
      <SubnavAnuncios />
      <div>
        <h1 className="text-xl font-semibold text-ink">Nuevo anuncio</h1>
        <p className="text-sm text-ink-muted">
          Se autoriza con la tasa de su clase vigente a la fecha de autorización, que fija el backend. El anuncio no se edita después.
        </p>
      </div>
      {registro.isSuccess ? (
        <Registrado registrado={registro.data} onOtro={otro} />
      ) : (
        <Card>
          <CardBody>
            <form onSubmit={registrar} className="space-y-4" aria-label="Nuevo anuncio">
              <div className="grid gap-4 lg:grid-cols-2">
                <RecordPicker
                  label="Titular"
                  placeholder="DNI, RUC o nombre"
                  value={titular}
                  onChange={setTitular}
                  search={(q) => rentas.contribuyentes(q, 0, 8)}
                  describe={describirContribuyente}
                />
                <div className="space-y-1">
                  <RecordPicker
                    label="Predio"
                    placeholder="Código o dirección"
                    value={predio}
                    onChange={setPredio}
                    search={(q) => rentas.predios(q, 0, 8)}
                    describe={describirPredio}
                    requerido={false}
                  />
                  {predio && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPredio(null)}>
                      Sin predio
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Campo etiqueta="Clase">
                  {(id) => (
                    <select id={id} required className={SELECT} {...campo('clase')}>
                      <option value="">Elija la clase</option>
                      {Object.entries(CLASES_ANUNCIO).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo etiqueta="Tipo">
                  {(id) => (
                    <select id={id} required className={SELECT} {...campo('tipo')}>
                      <option value="">Elija el tipo</option>
                      {Object.entries(TIPOS_ANUNCIO).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo etiqueta="Emplazamiento">{(id) => <Input id={id} maxLength={30} {...campo('emplazamiento')} />}</Campo>
                <Campo etiqueta="Forma">{(id) => <Input id={id} maxLength={30} {...campo('forma')} />}</Campo>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Campo etiqueta="Denominación">{(id) => <Input id={id} maxLength={240} {...campo('denominacion')} />}</Campo>
                <Campo etiqueta="Dirección">{(id) => <Input id={id} required maxLength={300} {...campo('direccion')} />}</Campo>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Campo etiqueta="Área m²">{(id) => <Input id={id} type="number" step="0.01" min="0.01" required {...campo('area')} />}</Campo>
                <Campo etiqueta="Lados">{(id) => <Input id={id} type="number" step="1" min="1" {...campo('lados')} />}</Campo>
                <Campo etiqueta="Cantidad">{(id) => <Input id={id} type="number" step="1" min="1" {...campo('cantidad')} />}</Campo>
                <Campo etiqueta="Autorizado el">{(id) => <Input id={id} type="date" {...campo('fecha_autorizacion')} />}</Campo>
                <Campo etiqueta="Vigente hasta">{(id) => <Input id={id} type="date" {...campo('vigencia_hasta')} />}</Campo>
                <Campo etiqueta="Licencia">{(id) => <Input id={id} maxLength={40} {...campo('licencia_texto')} />}</Campo>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Campo etiqueta="Expediente">{(id) => <Input id={id} maxLength={20} {...campo('expediente')} />}</Campo>
                <Campo etiqueta="Fecha del expediente">{(id) => <Input id={id} type="date" {...campo('fecha_expediente')} />}</Campo>
              </div>
              <Campo etiqueta="Observación">{(id) => <Textarea id={id} rows={3} maxLength={OBSERVACION_MAXIMA + 50} {...campo('observacion')} />}</Campo>
              <p className="text-xs text-ink-muted">
                Por qué se autoriza: de {OBSERVACION_MINIMA} a {OBSERVACION_MAXIMA} caracteres ({largo}).
              </p>
              {registro.isError && <ErrorDeRegistro error={registro.error} />}
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!puede && <p className="text-xs text-ink-muted">Sin permiso: autorizar un anuncio pide creación sobre los anuncios.</p>}
                <Button type="submit" disabled={!completo || !puede || registro.isPending}>
                  {registro.isPending ? <Loader2 className="size-4 animate-spin" /> : <FilePlus className="size-4" />}
                  Registrar anuncio
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

// a refusal: what is missing to accrue the tasa (the parámetro's key, never a 0), else the backend's words
function ErrorDeRegistro({ error }: { error: unknown }) {
  if (error instanceof RentasError && error.faltan.length > 0) {
    return (
      <Alert tone="warning" title="No se puede autorizar: falta">
        {error.faltan.join('; ')}. Sin la tasa de la clase el anuncio no se autoriza, y nunca a 0.
      </Alert>
    )
  }
  return (
    <Alert tone="danger">
      <MensajeDeError error={error} siFalla="No se pudo registrar el anuncio" />
    </Alert>
  )
}

function Registrado({ registrado: { anuncio, movimiento, ya_existia }, onOtro }: { registrado: AnuncioRegistrado; onOtro: () => void }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        {ya_existia ? (
          <Alert tone="notice" title={`El anuncio ${anuncio.numero} ya estaba registrado.`}>
            Este envío repetía uno anterior: no se registró otro ni se devengó otra vez.
          </Alert>
        ) : (
          <Alert tone="success" title={`Anuncio ${anuncio.numero} registrado.`}>
            {movimiento.tasa !== null
              ? `Autorizado el ${formatDate(movimiento.fecha)}: devenga ${formatMoney(movimiento.tasa)} del ejercicio ${movimiento.anio ?? '—'} (tasa al ${formatDate(movimiento.fecha)}).`
              : `Autorizado el ${formatDate(movimiento.fecha)}.`}
          </Alert>
        )}
        <div className="flex flex-wrap gap-3">
          <Link to={`/anuncios/${anuncio.id}`} className="text-sm text-link hover:underline">
            Ver la ficha del anuncio
          </Link>
          <Button type="button" variant="secondary" onClick={onOtro}>
            Registrar otro anuncio
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
