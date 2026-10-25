import { ApiError, EmptyState, LoadingState, QueryState, useAuth } from '@wasichai/core'
import { Alert, Badge, Button, Card, CardBody, cn, Input, Pagination, Table, Td, Th } from '@wasichai/ui'
import { ArrowLeft } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../kit/ui/errorMessage'
import { currentYear, formatMoney, formatText } from '../components/format'
import { usePuede } from '../components/permisos'
import { NUMERICA } from '../components/tabla'
import { YearSelect } from '../components/YearSelect'
import { useCambiosBrecha } from '../queries'
import type { CambioDelPredio, FiltrosCambiosBrecha, ObjetoCambioCatastro } from '../types'
import { Campo } from './AnunciosPages'
import { CATEGORIAS, Muestra } from './BrechaPage'
import { formatInstante, PILDORA } from './EmisionesPage'

// fiscalización's work list: the predios catastro changed since a date, each with the Δ autoavalúo of the year's latest
// brecha. the backend sorts them (the ones above 5 UIT first, then by |Δ|, those without a corrida last) and computes
// every figure: never reordered nor computed here

// what of catastro a cambio touched, as the clerk names it
export const OBJETOS: Record<ObjetoCambioCatastro, string> = {
  predio_catastral: 'Predio',
  construccion: 'Construcción',
  obra_complementaria: 'Obra complementaria',
  titular_catastral: 'Titular'
}

const SELECT = 'h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink'
const conEstado = (error: unknown, status: number) => error instanceof ApiError && error.status === status

export function CambiosCatastroPage() {
  const [anio, setAnio] = useState(currentYear)
  const [filtros, setFiltros] = useState<FiltrosCambiosBrecha>({})
  const [page, setPage] = useState(0)
  const ayuda = useId()
  // the permissions come after the session, as in the brecha: until then neither "sin permiso" nor a request
  const auth = useAuth()
  const conPermisos = auth.permissions !== null || auth.permissionsError !== null
  const puedeLeer = usePuede('brecha_corrida', 'READ')
  const cambios = useCambiosBrecha(anio, filtros, page, puedeLeer)
  // a filter (the year too) asks again from the first page
  const filtrar = (cambio: FiltrosCambiosBrecha) => {
    setFiltros((actuales) => ({ ...actuales, ...cambio }))
    setPage(0)
  }
  const elegirAnio = (valor: number) => {
    setAnio(valor)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/brecha">
            <ArrowLeft className="size-4" />
            Volver a la brecha
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-ink">Cambios en catastro</h1>
        <p className="text-sm text-ink-muted">
          Los predios que el catastro cambió desde la fecha, con el Δ autoavalúo de la última brecha calculada. Los que pasan de 5 UIT van primero y marcados.
        </p>
      </div>

      <Card>
        {/* the controls on one line, their bottoms aligned as in the other year panels; the help under the row, so it
            shifts none of them */}
        <CardBody>
          <div className="flex flex-wrap items-end gap-6">
            <YearSelect value={anio} onChange={elegirAnio} />
            <Campo etiqueta="Desde">
              {(id) => (
                <Input id={id} type="date" aria-describedby={ayuda} value={filtros.desde ?? ''} onChange={(e) => filtrar({ desde: e.target.value || null })} />
              )}
            </Campo>
            <Campo etiqueta="Objeto">
              {(id) => (
                <select
                  id={id}
                  className={SELECT}
                  value={filtros.objeto ?? ''}
                  onChange={(e) => filtrar({ objeto: (e.target.value || null) as ObjetoCambioCatastro | null })}
                >
                  <option value="">Todos</option>
                  {Object.entries(OBJETOS).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <label className="flex h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="accent-brand"
                checked={filtros.marca === 'SUPERA_5_UIT'}
                onChange={(e) => filtrar({ marca: e.target.checked ? 'SUPERA_5_UIT' : null })}
              />
              Solo los que superan 5 UIT
            </label>
          </div>
          <p id={ayuda} className="mt-2 text-xs text-ink-muted">{`Desde en blanco: el 1 de enero de ${anio}.`}</p>
        </CardBody>
      </Card>

      {!conPermisos ? (
        <LoadingState />
      ) : !puedeLeer ? (
        <Alert tone="notice">Sin permiso para ver la brecha: pide lectura sobre las corridas de brecha.</Alert>
      ) : conEstado(cambios.error, 404) ? (
        <Card>
          <EmptyState title={`Aún no se ha calculado la brecha de ${anio}`}>
            <p>
              Calcúlala en la{' '}
              <Link to="/brecha" className="text-link hover:underline">
                brecha de recaudación
              </Link>
              : los cambios se comparan con su último resultado.
            </p>
          </EmptyState>
        </Card>
      ) : cambios.isError ? (
        <Alert tone="danger">{errorMessage(cambios.error, 'No se pudieron leer los cambios en catastro')}</Alert>
      ) : (
        <Card>
          <QueryState query={cambios}>
            {(resultado) =>
              resultado.content.length === 0 ? (
                <EmptyState title="Sin cambios en catastro con ese filtro" />
              ) : (
                <>
                  <Table aria-label="Cambios en catastro">
                    <thead>
                      <tr>
                        <Th>Código</Th>
                        <Th>Marca</Th>
                        <Th>Categoría</Th>
                        <Th {...NUMERICA}>Cambios</Th>
                        <Th>Objetos</Th>
                        <Th>Entregas</Th>
                        <Th>Último cambio</Th>
                        <Th {...NUMERICA}>Autoavalúo declarado</Th>
                        <Th {...NUMERICA}>Autoavalúo catastro</Th>
                        <Th {...NUMERICA}>Δ autoavalúo</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.content.map((fila) => (
                        <Fila key={fila.codigoMunicipal} fila={fila} />
                      ))}
                    </tbody>
                  </Table>
                  <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={setPage} />
                </>
              )
            }
          </QueryState>
        </Card>
      )}
    </div>
  )
}

// a marked row (above 5 UIT) on a soft tint of the warning, its pill in the same tone right after the code: the mark
// that matters most is seen without scrolling the table
function Fila({ fila }: { fila: CambioDelPredio }) {
  const codigo = fila.codigoPredio ?? fila.codigoMunicipal
  const marcada = fila.marca === 'SUPERA_5_UIT'
  return (
    <tr data-marca={fila.marca ?? undefined} className={cn('align-top', marcada && 'bg-warning/5')}>
      <Td className="font-medium whitespace-nowrap">
        {fila.predio ? (
          <Link to={`/predios/${fila.predio}`} className="text-link hover:underline">
            {formatText(codigo)}
          </Link>
        ) : (
          formatText(codigo)
        )}
        {fila.codigoMunicipal !== codigo && <p className="text-xs font-normal text-ink-muted">Catastro {fila.codigoMunicipal}</p>}
      </Td>
      <Td>
        {marcada && (
          <Badge data-tono="ambar" className={cn('whitespace-nowrap', PILDORA.ambar)}>
            Supera 5 UIT
          </Badge>
        )}
      </Td>
      <Td>
        {fila.categoria ? (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Muestra categoria={fila.categoria} />
            {CATEGORIAS[fila.categoria]?.singular ?? fila.categoria}
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </Td>
      <Td {...NUMERICA}>{fila.cambios.toLocaleString('es-PE')}</Td>
      <Td className="min-w-32">{fila.objetos.map((objeto) => OBJETOS[objeto] ?? objeto).join(', ') || '—'}</Td>
      <Td>{fila.entregas.join(', ') || '—'}</Td>
      <Td className="whitespace-nowrap">{formatInstante(fila.ultimoCambio)}</Td>
      <Td {...NUMERICA}>{formatMoney(fila.autoavaluoDeclarado)}</Td>
      <Td {...NUMERICA}>{formatMoney(fila.autoavaluoCatastro)}</Td>
      <Td {...NUMERICA}>{formatMoney(fila.deltaAutoavaluo)}</Td>
    </tr>
  )
}
