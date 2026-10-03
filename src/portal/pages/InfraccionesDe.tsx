import { EmptyState, QueryState } from '@wasichai/core'
import { Table, Td, Th } from '@wasichai/ui'
import { Link } from 'react-router'
import { EstadoDeudaBadge } from '../components/EstadoDeudaBadge'
import { FaseBadge } from '../components/FaseBadge'
import { formatDate, formatMoney } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { useInfraccionesDe } from '../queries'

// the infracciones tab of a contribuyente's ficha (its actas as obligado or contribuyente) or a predio's: each acta with
// its importe as frozen on fecha_calculo, and its fase and estado de la deuda at al_dia as two columns with their own
// names, all the backend's. a número opens the expediente
export function InfraccionesDe({ de, id }: { de: 'contribuyentes' | 'predios'; id: string }) {
  const query = useInfraccionesDe(de, id)
  return (
    <QueryState query={query}>
      {({ al_dia, actas }) =>
        actas.length === 0 ? (
          <EmptyState title="Sin infracciones">
            <p>{de === 'contribuyentes' ? 'Ninguna acta nombra a este contribuyente.' : 'Ninguna acta nombra este predio.'}</p>
          </EmptyState>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">Fase y estado de la deuda al {formatDate(al_dia)}.</p>
            <Table aria-label={`Infracciones al ${formatDate(al_dia)}`}>
              <thead>
                <tr>
                  <Th>Número</Th>
                  <Th>Fecha</Th>
                  <Th>Código</Th>
                  <Th {...NUMERICA}>Importe a pagar</Th>
                  <Th>Fase al {formatDate(al_dia)}</Th>
                  <Th>Estado de la deuda</Th>
                </tr>
              </thead>
              <tbody>
                {actas.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-semibold whitespace-nowrap">
                      <Link to={`/infracciones/${p.id}`} className="text-link hover:underline">
                        {p.numero}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(p.fecha_infraccion)}</Td>
                    <Td>
                      <span className="font-medium">{p.codigo}</span>
                      {p.descripcion_infraccion && <span className="block text-xs text-ink-muted">{p.descripcion_infraccion}</span>}
                    </Td>
                    <Td {...NUMERICA}>
                      {formatMoney(p.importe_a_pagar)}
                      <span className="block text-xs text-ink-muted">al {formatDate(p.fecha_calculo)}</span>
                    </Td>
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
          </div>
        )
      }
    </QueryState>
  )
}
