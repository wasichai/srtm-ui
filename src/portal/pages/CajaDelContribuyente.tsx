import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, EmptyState, QueryState } from '@wasichai/core'
import { Alert, Badge, Button, Table, Td, Th } from '@wasichai/ui'
import { Send } from 'lucide-react'
import { rentas } from '../api'
import { publicarCaja } from '../components/avisoCaja'
import { BadgeDeMapa, type EtiquetaDeMapa } from '../components/BadgeDeMapa'
import { formatMoney, formatText } from '../components/format'
import { usePuede } from '../components/permisos'
import { NUMERICA } from '../components/tabla'
import { errorMessage } from '../../kit/ui/errorMessage'

// a contribuyente's year in its organization's caja (wasichai/srtm-ui#123): the ordenes de cobro that cuotas of predial and
// of arbitrios became, what each one is in caja, and the saldo a favor caja collected that srtm could not apply to a debt.
// «Enviar a caja» sends what changed and tries the ordenes in ERROR again; the aviso says what came of it. an
// organization without caja (409) says so, with no button: it is not an error

const ESTADOS: Record<string, EtiquetaDeMapa> = {
  POR_ENVIAR: { texto: 'Por enviar', tono: 'ambar' },
  ENVIADA: { texto: 'En caja', tono: '' },
  POR_RETIRAR: { texto: 'Por retirar', tono: 'ambar' },
  RETIRADA: { texto: 'Retirada', tono: '' },
  PAGADA_EN_CAJA: { texto: 'Pagada en caja', tono: 'verde' },
  CONFLICTO: { texto: 'Conflicto', tono: 'rojo' },
  ERROR: { texto: 'Error', tono: 'rojo' },
  CANCELADA: { texto: 'Cancelada', tono: '' }
}

export function CajaDelContribuyente({ id, anio }: { id: string; anio: number }) {
  const puede = usePuede('orden_caja')
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['caja', id, anio],
    queryFn: () => rentas.cajaDeContribuyente(id, anio),
    placeholderData: keepPreviousData
  })
  const enviar = useMutation({
    mutationFn: () => rentas.enviarACaja(id, anio),
    // the aviso shows the answer (the POST is read here, never from its header); the list is read again
    onSuccess: (resumen) => {
      publicarCaja(resumen)
      void queryClient.invalidateQueries({ queryKey: ['caja'] })
    }
  })

  if (query.error instanceof ApiError && query.error.status === 409) {
    return <p className="text-sm text-ink-muted">La municipalidad no tiene caja configurada</p>
  }

  return (
    <QueryState query={query}>
      {(caja) => (
        <div className="space-y-4">
          <div className="flex flex-col items-start gap-1">
            <Button variant="secondary" disabled={!puede || enviar.isPending} onClick={() => enviar.mutate()}>
              <Send className="size-4" />
              {enviar.isPending ? 'Enviando…' : 'Enviar a caja'}
            </Button>
            {!puede && <p className="text-xs text-ink-muted">Sin permiso: enviar a caja pide creación sobre las órdenes de caja.</p>}
            {(enviar.data?.sin_documento ?? 0) > 0 && <p className="text-xs text-ink-muted">El contribuyente no tiene documento: no se envía a caja</p>}
          </div>
          {enviar.isError && <Alert tone="danger">{errorMessage(enviar.error, 'No se pudo enviar a caja')}</Alert>}
          {caja.saldo_a_favor > 0 && <p className="text-sm font-semibold">Saldo a favor: {formatMoney(caja.saldo_a_favor)}</p>}
          {caja.ordenes.length === 0 ? (
            <EmptyState title={`No hay órdenes en caja para ${anio}`} />
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label={`Órdenes en caja ${anio}`}>
                <thead>
                  <tr>
                    <Th>Referencia</Th>
                    <Th>Concepto</Th>
                    <Th {...NUMERICA}>Importe</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {caja.ordenes.map((o, i) => (
                    <tr key={o.id ?? `${o.referencia}-${i}`}>
                      <Td>{formatText(o.referencia)}</Td>
                      <Td>{formatText(o.concepto)}</Td>
                      <Td {...NUMERICA}>{formatMoney(o.importe)}</Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeDeMapa valor={o.estado} mapa={ESTADOS} />
                          {o.pagada && <Badge>Pagada</Badge>}
                          {o.recibo && <span className="text-xs text-ink-muted">Recibo {o.recibo}</span>}
                        </div>
                        {o.ultimo_error && <p className="mt-1 text-xs text-danger">{o.ultimo_error}</p>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      )}
    </QueryState>
  )
}
