import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Alert, Card, CardBody, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { Link } from 'react-router'
import { rentas } from '../api'
import { currentYear, formatDate, formatMoney, formatText, MESES } from '../components/format'
import { Popover } from '../components/Popover'
import { NUMERICA } from '../components/tabla'
import { YearSelect } from '../components/YearSelect'
import { parametrosArbitrioQuery } from '../queries'
import type { ParametroTributario, ServicioArbitrio } from '../types'
import { SubnavArbitrios } from './SubnavArbitrios'

// the arbitrios of a year beyond one ficha (wasichai/srtm-backend#62): the cuotas determined, by servicio, and the
// ordinance they come from with its tasas, zonas, usos and due dates. a predio's or a contribuyente's own are in its
// ficha's Arbitrios tab, where they can be determined

const nombreDe = (servicios: ServicioArbitrio[] | undefined, id: string) => {
  const s = servicios?.find((x) => x.id === id)
  return s ? (s.nombre ?? s.codigo) : id
}

export function ConsultaArbitriosPage() {
  const [anio, setAnio] = useState(currentYear)
  const [servicio, setServicio] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const servicios = useQuery({ queryKey: ['arbitrios', 'servicios', anio], queryFn: () => rentas.serviciosArbitrio(anio) })
  const cuotas = useQuery({
    queryKey: ['arbitrios', 'cuotas', anio, servicio, page],
    queryFn: () => rentas.cuotasArbitrio(anio, servicio, page),
    placeholderData: keepPreviousData
  })
  const elegirAnio = (valor: number) => {
    setAnio(valor)
    setServicio(null)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <SubnavArbitrios />
      <div>
        <h1 className="text-xl font-semibold text-ink">Consulta de cuotas de arbitrios</h1>
        <p className="text-sm text-ink-muted">Las cuotas determinadas de un año, mes a mes. Las de un predio o un contribuyente están en su ficha.</p>
      </div>
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-6">
            <YearSelect value={anio} onChange={elegirAnio} />
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              Servicio
              <select
                className="rounded-md border border-border bg-surface px-2 py-1 text-ink"
                value={servicio ?? ''}
                onChange={(e) => {
                  setServicio(e.target.value || null)
                  setPage(0)
                }}
              >
                <option value="">Todos</option>
                {(servicios.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre ?? s.codigo}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardBody>
      </Card>
      <Card>
        <QueryState query={cuotas}>
          {(resultado) =>
            resultado.content.length === 0 ? (
              <EmptyState title={`Sin cuotas determinadas en ${anio}`}>
                <p>Se determinan desde la ficha de un predio o de un contribuyente.</p>
              </EmptyState>
            ) : (
              <>
                <Table aria-label={`Cuotas de arbitrios ${anio}`}>
                  <thead>
                    <tr>
                      <Th>Mes</Th>
                      <Th>Servicio</Th>
                      <Th {...NUMERICA}>Monto</Th>
                      <Th>Determinada el</Th>
                      <Th>Predio</Th>
                      <Th>Contribuyente</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.content.map((c) => (
                      <tr key={c.id}>
                        <Td>{MESES[c.periodo - 1]}</Td>
                        <Td>{nombreDe(servicios.data, c.servicio)}</Td>
                        <Td {...NUMERICA}>
                          {c.parametro_aplicado ? <Popover trigger={formatMoney(c.monto)}>{c.parametro_aplicado}</Popover> : formatMoney(c.monto)}
                        </Td>
                        <Td>{formatDate(c.fecha_calculo)}</Td>
                        <Td>
                          <Link to={`/predios/${c.predio}?tab=arbitrios`} className="text-link hover:underline">
                            Ver predio
                          </Link>
                        </Td>
                        <Td>
                          <Link to={`/contribuyentes/${c.contribuyente}?tab=arbitrios`} className="text-link hover:underline">
                            Ver contribuyente
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={setPage} />
              </>
            )
          }
        </QueryState>
      </Card>
    </div>
  )
}

const de = (parametros: ParametroTributario[], tipo: string) => parametros.filter((p) => p.tipo === tipo)

const vigencia = (p: ParametroTributario) => `${formatDate(p.vigencia_desde)} – ${p.vigencia_hasta ? formatDate(p.vigencia_hasta) : 'en adelante'}`

export function TasasArbitriosPage() {
  const [anio, setAnio] = useState(currentYear)
  const query = useQuery({ ...parametrosArbitrioQuery(anio), placeholderData: keepPreviousData })

  return (
    <div className="space-y-5">
      <SubnavArbitrios />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Tasas de arbitrios</h1>
          <p className="text-sm text-ink-muted">La ordenanza del año, sus servicios, sus tasas mensuales y cómo se asignan la zona y el uso de cada predio</p>
        </div>
        <YearSelect value={anio} onChange={setAnio} />
      </div>
      <QueryState query={query}>
        {(p) => (
          <div className="space-y-5">
            {p.faltan.length > 0 && (
              <Alert tone="warning" title={`Al año ${anio} le falta:`}>
                {p.faltan.join('; ')}. Sin eso no se determinan sus arbitrios.
              </Alert>
            )}
            <Card>
              <CardBody>
                <h2 className="mb-2 text-sm font-semibold">Ordenanza</h2>
                {p.ordenanza ? (
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <dt className="text-ink-muted">Número</dt>
                    <dd>{formatText(p.ordenanza.numero)}</dd>
                    <dt className="text-ink-muted">Publicada</dt>
                    <dd>{formatDate(p.ordenanza.fecha_publicacion)}</dd>
                    <dt className="text-ink-muted">Ratificación</dt>
                    <dd>
                      {p.ordenanza.acuerdo_ratificacion
                        ? `${p.ordenanza.acuerdo_ratificacion}${p.ordenanza.municipalidad_ratificante ? `, ${p.ordenanza.municipalidad_ratificante}` : ''} (${formatDate(p.ordenanza.fecha_ratificacion)})`
                        : 'Sin ratificar'}
                    </dd>
                  </dl>
                ) : (
                  <p className="text-sm text-ink-muted">No hay ordenanza de arbitrios de {anio}.</p>
                )}
              </CardBody>
            </Card>
            <Tabla
              titulo="Tasas mensuales"
              filas={de(p.parametros, 'TASA_ARBITRIO')}
              columnas={['Servicio', 'Zona', 'Uso']}
              partes={(f) => (f.clave ?? '').split(':')}
              valor={(f) => formatMoney(f.valor_numerico)}
              numerica
            />
            <Tabla titulo="Zona de cada sector catastral" filas={de(p.parametros, 'ARBITRIO_ZONA')} columnas={['Sector']} valor={(f) => formatText(f.texto)} />
            <Tabla
              titulo="Uso de arbitrio de cada uso del predio"
              filas={de(p.parametros, 'ARBITRIO_USO')}
              columnas={['Código de uso']}
              valor={(f) => formatText(f.texto)}
            />
            <Tabla
              titulo="Vencimientos"
              filas={de(p.parametros, 'ARBITRIO_VENCIMIENTO')}
              columnas={['Mes']}
              partes={(f) => [MESES[Number(f.clave) - 1] ?? formatText(f.clave)]}
              valor={(f) => formatDate(f.texto)}
            />
          </div>
        )}
      </QueryState>
    </div>
  )
}

// the rows of one tipo: its key in `columnas` (split by `partes`), its value, its vigencia and its norma
function Tabla({
  titulo,
  filas,
  columnas,
  partes = (f) => [formatText(f.clave)],
  valor,
  numerica = false
}: {
  titulo: string
  filas: ParametroTributario[]
  columnas: string[]
  partes?: (f: ParametroTributario) => string[]
  valor: (f: ParametroTributario) => string
  numerica?: boolean
}) {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
        {filas.length === 0 ? (
          <p className="text-sm text-ink-muted">Ninguna en el año.</p>
        ) : (
          <Table aria-label={titulo}>
            <thead>
              <tr>
                {columnas.map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
                <Th {...(numerica ? NUMERICA : {})}>Valor</Th>
                <Th>Vigencia</Th>
                <Th>Norma</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id ?? `${f.tipo}-${f.clave}-${f.vigencia_desde}`}>
                  {partes(f).map((parte, i) => (
                    <Td key={columnas[i] ?? i}>{parte}</Td>
                  ))}
                  <Td {...(numerica ? NUMERICA : {})}>{valor(f)}</Td>
                  <Td>{vigencia(f)}</Td>
                  <Td>{formatText(f.norma)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  )
}
