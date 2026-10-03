import { EmptyState, QueryState } from '@wasichai/core'
import { Button, Card, CardBody, Input, Label, Pagination, Table, Td, Th } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { EstadoAnuncioBadge, ESTADOS_ANUNCIO } from '../components/EstadoAnuncioBadge'
import { currentYear, formatDate, formatMoney, formatNumber, formatText, today } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { YearSelect } from '../components/YearSelect'
import { describirContribuyente } from '../forms/bloques'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import { useAnuncios, useAnunciosDe, useTasasAnuncios } from '../queries'
import type { ClaseAnuncio, EstadoAnuncio, FiltrosAnuncios } from '../types'
import { CLASES_ANUNCIO, etiqueta, TIPOS_ANUNCIO, vigenciaVigente } from './etiquetasAnuncio'
import { SubnavAnuncios } from './SubnavAnuncios'

// the tasa de anuncios y propaganda beyond one ficha: the padrón with each anuncio's estado on a day and the tasas of a
// year by clase. the estado and the vigencia in force are the backend's at the date shown, never derived here from an
// anuncio's dates; a clase without tasa says so, never a 0

export function Campo({ etiqueta, children }: { etiqueta: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children(id)}
    </div>
  )
}

const SELECT = 'h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink'

export function PadronAnunciosPage() {
  const [filtros, setFiltros] = useState<FiltrosAnuncios>(() => ({ vigentes_a: today() }))
  const [page, setPage] = useState(0)
  const [titular, setTitular] = useState<Picked | null>(null)
  const [borrador, setBorrador] = useState<{ clase: string; estado: string; vigentes_a: string; q: string }>({
    clase: '',
    estado: '',
    vigentes_a: today(),
    q: ''
  })
  const query = useAnuncios(filtros, page)

  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setPage(0)
    setFiltros({
      contribuyente: titular?.id,
      clase: (borrador.clase || undefined) as ClaseAnuncio | undefined,
      estado: (borrador.estado || undefined) as EstadoAnuncio | undefined,
      vigentes_a: borrador.vigentes_a || today(),
      q: borrador.q.trim() || undefined
    })
  }

  return (
    <div className="space-y-5">
      <SubnavAnuncios />
      <div>
        <h1 className="text-xl font-semibold text-ink">Padrón de anuncios</h1>
        <p className="text-sm text-ink-muted">Los anuncios autorizados, con su estado y la vigencia que rige a una fecha.</p>
      </div>
      <Card>
        <CardBody className="space-y-4">
          <form role="search" aria-label="Filtros del padrón de anuncios" onSubmit={buscar} className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-72">
                <RecordPicker
                  label="Titular"
                  placeholder="DNI, RUC o nombre"
                  value={titular}
                  onChange={setTitular}
                  search={(q) => rentas.contribuyentes(q, 0, 8)}
                  describe={describirContribuyente}
                  requerido={false}
                />
              </div>
              {titular && (
                <Button type="button" variant="ghost" onClick={() => setTitular(null)}>
                  Todos los titulares
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Campo etiqueta="Clase">
                {(id) => (
                  <select id={id} className={SELECT} value={borrador.clase} onChange={(e) => setBorrador({ ...borrador, clase: e.target.value })}>
                    <option value="">Todas</option>
                    {Object.entries(CLASES_ANUNCIO).map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Estado">
                {(id) => (
                  <select id={id} className={SELECT} value={borrador.estado} onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })}>
                    <option value="">Todos</option>
                    {Object.entries(ESTADOS_ANUNCIO).map(([valor, { texto }]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Estado al">
                {(id) => (
                  <Input id={id} type="date" required value={borrador.vigentes_a} onChange={(e) => setBorrador({ ...borrador, vigentes_a: e.target.value })} />
                )}
              </Campo>
              <Campo etiqueta="Número, denominación o dirección">
                {(id) => <Input id={id} type="search" value={borrador.q} onChange={(e) => setBorrador({ ...borrador, q: e.target.value })} />}
              </Campo>
              <Button type="submit">
                <Search className="size-4" />
                Buscar
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <QueryState query={query}>
          {(resultado) => {
            // the date the backend derived the estado at: its rows', else the one asked
            const al = formatDate(resultado.content[0]?.vigentes_a ?? filtros.vigentes_a)
            return resultado.content.length === 0 ? (
              <EmptyState title={`Ningún anuncio al ${al}`}>
                <p>Cambie la fecha o los filtros, o registre un anuncio.</p>
              </EmptyState>
            ) : (
              <>
                <p className="px-4 pt-3 text-sm text-ink-muted" data-testid="padron-al">
                  Estado y vigencia al {al}.
                </p>
                <Table aria-label={`Anuncios al ${al}`}>
                  <thead>
                    <tr>
                      <Th>Número</Th>
                      <Th>Titular</Th>
                      <Th>Clase</Th>
                      <Th>Tipo</Th>
                      <Th>Dirección</Th>
                      <Th {...NUMERICA}>Área m²</Th>
                      <Th>Vigente hasta</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.content.map((a) => (
                      <tr key={a.id}>
                        <Td className="font-semibold whitespace-nowrap">
                          <Link to={`/anuncios/${a.id}`} className="text-link hover:underline">
                            {a.numero}
                          </Link>
                        </Td>
                        <Td>{formatText(a.contribuyente_nombre)}</Td>
                        <Td>{etiqueta(CLASES_ANUNCIO, a.clase)}</Td>
                        <Td>{etiqueta(TIPOS_ANUNCIO, a.tipo)}</Td>
                        <Td>
                          {a.direccion}
                          {a.denominacion && <span className="block text-xs text-ink-muted">{a.denominacion}</span>}
                        </Td>
                        <Td {...NUMERICA}>{formatNumber(a.area)}</Td>
                        <Td className="whitespace-nowrap">{vigenciaVigente(a.vigencia_hasta_vigente)}</Td>
                        <Td>
                          <EstadoAnuncioBadge estado={a.estado} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={setPage} />
              </>
            )
          }}
        </QueryState>
      </Card>
    </div>
  )
}

export function TasasAnunciosPage() {
  const [anio, setAnio] = useState(currentYear)
  const query = useTasasAnuncios(anio)

  return (
    <div className="space-y-5">
      <SubnavAnuncios />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Tasas de anuncios</h1>
          <p className="text-sm text-ink-muted">
            La tasa de cada clase de anuncio en el año, por ejercicio completo. Sin tasa, una clase no se autoriza ni se renueva.
          </p>
        </div>
        <YearSelect value={anio} onChange={setAnio} />
      </div>
      <QueryState query={query}>
        {(t) => (
          <div className="space-y-4">
            {t.faltan.length > 0 && (
              <Alerta tono="atencion" titulo={`Al año ${t.anio} le falta:`}>
                {t.faltan.join('; ')}. Sin eso esas clases no se autorizan: nunca a 0.
              </Alerta>
            )}
            <Card>
              {t.tasas.length === 0 ? (
                <EmptyState title={`Sin tasas de anuncios en ${t.anio}`}>
                  <p>Se cargan como parámetro tributario TASA_ANUNCIO, una por clase.</p>
                </EmptyState>
              ) : (
                <Table aria-label={`Tasas de anuncios ${t.anio}`}>
                  <thead>
                    <tr>
                      <Th>Clase</Th>
                      <Th {...NUMERICA}>Tasa</Th>
                      <Th>Vigente desde</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.tasas.map((tasa) => (
                      <tr key={`${tasa.clase}-${tasa.parametro_id}`}>
                        <Td>{etiqueta(CLASES_ANUNCIO, tasa.clase)}</Td>
                        <Td {...NUMERICA}>{formatMoney(tasa.tasa)}</Td>
                        <Td>{formatDate(tasa.vigencia_desde)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        )}
      </QueryState>
    </div>
  )
}

// a ficha's Anuncios tab: the titular's or the predio's anuncios, each with its estado at the backend's al_dia. the
// acts (renovar, cesar, retirar) are in each anuncio's ficha
export function AnunciosDe({ de, id }: { de: 'contribuyentes' | 'predios'; id: string }) {
  const query = useAnunciosDe(de, id)
  return (
    <QueryState query={query}>
      {({ al_dia, anuncios }) =>
        anuncios.length === 0 ? (
          <EmptyState title="Sin anuncios">
            <p>{de === 'contribuyentes' ? 'El contribuyente no es titular de ningún anuncio.' : 'Ningún anuncio nombra este predio.'}</p>
          </EmptyState>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">Estado y vigencia al {formatDate(al_dia)}.</p>
            <Table aria-label={`Anuncios al ${formatDate(al_dia)}`}>
              <thead>
                <tr>
                  <Th>Número</Th>
                  <Th>Clase</Th>
                  <Th>Tipo</Th>
                  <Th>Dirección</Th>
                  <Th>Autorizado el</Th>
                  <Th>Vigente hasta</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {anuncios.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-semibold whitespace-nowrap">
                      <Link to={`/anuncios/${a.id}`} className="text-link hover:underline">
                        {a.numero}
                      </Link>
                    </Td>
                    <Td>{etiqueta(CLASES_ANUNCIO, a.clase)}</Td>
                    <Td>{etiqueta(TIPOS_ANUNCIO, a.tipo)}</Td>
                    <Td>{a.direccion}</Td>
                    <Td>{formatDate(a.fecha_autorizacion)}</Td>
                    <Td className="whitespace-nowrap">{vigenciaVigente(a.vigencia_hasta_vigente)}</Td>
                    <Td>
                      <EstadoAnuncioBadge estado={a.estado} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )
      }
    </QueryState>
  )
}
