import { LoadingState } from '@wasichai/core'
import { Alert, Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { useVisorNiveles } from '../../queries'
import { COLOR_CATEGORIA, COLOR_NIVEL, ETIQUETA_NIVEL, etiquetaCategoria, etiquetaEstado } from './colores'
import { metros, soles } from './formato'
import { usePantallaAncha } from './pantalla'
import type { FilaVisor, NivelVisor } from './tipos'

// how the visor names a row: srtm's código of the predio, else catastro's, else its id
export const nombreDeFila = (f: Pick<FilaVisor, 'codigo_predio' | 'codigo_catastro' | 'id'>) => f.codigo_predio ?? f.codigo_catastro ?? f.id

// the area catastro surveyed beyond what was declared, on the pisos found in both: the Δ of the PAR niveles where
// catastro is larger. a piso in only one of them is a missing piso, not a difference of area, so it is left out
export function excesoPar(niveles: NivelVisor[]): number {
  return niveles.reduce((suma, n) => {
    const d = Number(n.delta)
    return n.estado === 'PAR' && n.delta !== null && Number.isFinite(d) && d > 0 ? suma + d : suma
  }, 0)
}

function ChipNivel({ estado }: { estado: NivelVisor['estado'] }) {
  return (
    <Badge className="gap-1 whitespace-nowrap">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_NIVEL[estado] }} />
      {ETIQUETA_NIVEL[estado] ?? estado}
    </Badge>
  )
}

const nombreDePiso = (n: NivelVisor) => (n.piso === null ? 'Piso sin número' : `Piso ${n.piso}`)

// a narrow screen: one card per piso, the piso and its estado on top and the areas below, so the estado is never
// scrolled out of view as it is in the table (catastro-ui#24)
function TarjetasNiveles({ niveles }: { niveles: NivelVisor[] }) {
  return (
    <ul aria-label="Niveles del predio" className="space-y-2">
      {niveles.map((n, i) => (
        <li key={`${n.piso ?? 'sin'}-${i}`} aria-label={nombreDePiso(n)} className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">{nombreDePiso(n)}</span>
            <ChipNivel estado={n.estado} />
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-muted">Área rentas</dt>
            <dd className="text-right text-ink tabular-nums">{metros(n.area_rentas)}</dd>
            <dt className="text-ink-muted">Área catastro</dt>
            <dd className="text-right text-ink tabular-nums">{metros(n.area_catastro)}</dd>
            <dt className="text-ink-muted">Δ m²</dt>
            <dd className="text-right font-medium text-ink tabular-nums">{metros(n.delta, { signo: true })}</dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}

// a wide screen: the pisos side by side, in a table
function TablaNiveles({ niveles }: { niveles: NivelVisor[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table aria-label="Niveles del predio">
        <thead>
          <tr>
            <Th>Piso</Th>
            <Th className="text-right">Área rentas</Th>
            <Th className="text-right">Área catastro</Th>
            <Th className="text-right">Δ m²</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {niveles.map((n, i) => (
            <tr key={`${n.piso ?? 'sin'}-${i}`}>
              <Td className="tabular-nums">{n.piso ?? '—'}</Td>
              <Td className="text-right tabular-nums whitespace-nowrap">{metros(n.area_rentas)}</Td>
              <Td className="text-right tabular-nums whitespace-nowrap">{metros(n.area_catastro)}</Td>
              <Td className="text-right font-medium tabular-nums whitespace-nowrap">{metros(n.delta, { signo: true })}</Td>
              <Td>
                <ChipNivel estado={n.estado} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function Niveles({ niveles }: { niveles: NivelVisor[] }) {
  const ancha = usePantallaAncha()
  if (!niveles.length) return <p className="text-sm text-ink-muted">Sin niveles en esta corrida</p>
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        {'Más área en catastro en los pisos de ambos: '}
        <span className="font-medium tabular-nums">{metros(excesoPar(niveles), { signo: true })}</span>
      </p>
      {ancha ? <TablaNiveles niveles={niveles} /> : <TarjetasNiveles niveles={niveles} />}
    </div>
  )
}

export interface DetalleNivelesProps {
  // the row that was opened; null when the dialog is closed
  fila: FilaVisor | null
  onCerrar: () => void
}

// a row of the corrida: what the table says of it, and the areas of its pisos as srtm matched them. the row shows at
// once; the niveles come from GET /predios/{id}/niveles
export function DetalleNiveles({ fila, onCerrar }: DetalleNivelesProps) {
  const niveles = useVisorNiveles(fila?.id ?? null)
  return (
    <Dialog open={fila !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        {fila && (
          <>
            <DialogTitle className="text-lg font-semibold break-all text-ink">{`Predio ${nombreDeFila(fila)}`}</DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CATEGORIA[fila.categoria] }} />
                {etiquetaCategoria(fila.categoria)}
              </span>
              <span>{`Diferencia de impuesto ${soles(fila.delta_impuesto, { signo: true })}`}</span>
              <span>{etiquetaEstado(fila.estado)}</span>
            </DialogDescription>
            <section aria-labelledby="niveles-predio" className="mt-4 space-y-2">
              <h3 id="niveles-predio" className="text-sm font-semibold text-ink">
                Niveles
              </h3>
              {niveles.isError ? (
                <Alert tone="danger">
                  <span className="flex flex-wrap items-center gap-2">
                    {errorMessage(niveles.error, 'No se pudieron cargar los niveles')}
                    <Button size="sm" variant="secondary" onClick={() => void niveles.refetch()}>
                      Reintentar
                    </Button>
                  </span>
                </Alert>
              ) : niveles.data ? (
                <Niveles niveles={niveles.data} />
              ) : (
                <LoadingState />
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
