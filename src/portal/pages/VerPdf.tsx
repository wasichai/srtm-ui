import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { FileText, UserRound } from 'lucide-react'
import { useState } from 'react'
import { rentas, type TitularPu } from '../api'
import { Button } from '../components/controles'
import { anulada } from '../components/EstadoBadge'
import { PdfDialog } from '../components/PdfDialog'
import { LoadingState } from '../components/QueryState'

// Ver PU and Ver HR (wasichai/srtm-ui#61): srtm-backend makes the PDF, PdfDialog shows it

const pu = (predio: string, anio: number, contribuyente?: string) =>
  `/srtm/predios/${predio}/pu?${new URLSearchParams({ anio: String(anio), ...(contribuyente ? { contribuyente } : {}) })}`

// the vigentes titulares of the predio in the year, from its declaraciones: each one once
function useTitulares(predio: string, anio: number, enabled: boolean) {
  return useQuery({
    queryKey: ['predio', predio, 'declaraciones', anio],
    queryFn: () => rentas.declaracionesDePredio(predio, anio),
    enabled,
    select: (filas): TitularPu[] => {
      const vistos = new Set<string>()
      return filas.flatMap(({ declaracion, contribuyente }) => {
        const id = contribuyente?.id ?? declaracion.contribuyente
        if (anulada(declaracion) || !id || vistos.has(id)) return []
        vistos.add(id)
        const documento = [contribuyente?.tipo_documento, contribuyente?.numero_documento].filter(Boolean).join(' ')
        return [{ id, nombre: contribuyente?.nombre_completo ?? id, documento: documento || null }]
      })
    }
  })
}

function ElegirTitular({
  titulares,
  cargando,
  onElegir,
  onClose
}: {
  titulares: TitularPu[]
  cargando: boolean
  onElegir: (id: string) => void
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-semibold">Elegir el titular</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-ink-muted">El predio tiene más de un titular: la PU es de uno de ellos.</DialogDescription>
        {cargando ? (
          <LoadingState />
        ) : (
          <ul className="mt-4 space-y-2">
            {titulares.map((t) => (
              <li key={t.id}>
                <Button variant="secondary" className="w-full justify-start" onClick={() => onElegir(t.id)}>
                  <UserRound className="size-4" />
                  <span className="truncate">{t.nombre}</span>
                  {t.documento && <span className="ml-auto text-xs text-ink-muted">{t.documento}</span>}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// the ficha del predio's Ver PU, for the year picked: of its one titular straight away; with several (the ficha counts
// them, or the backend answers 409 with them), of the one picked
export function VerPu({ predio, codigo, anio, titulares }: { predio: string; codigo: string; anio: number; titulares: number }) {
  const [abierto, setAbierto] = useState<{ path: string } | null>(null)
  const [elegir, setElegir] = useState<{ desde409: TitularPu[] | null } | null>(null)
  const declarados = useTitulares(predio, anio, elegir !== null && elegir.desde409 === null)
  const titulo = `PU — ${codigo} — ${anio}`

  const ver = () => (titulares > 1 ? setElegir({ desde409: null }) : setAbierto({ path: pu(predio, anio) }))

  return (
    <>
      <Button variant="secondary" onClick={ver}>
        <FileText className="size-4" />
        Ver PU
      </Button>
      {elegir && (
        <ElegirTitular
          titulares={elegir.desde409 ?? declarados.data ?? []}
          cargando={elegir.desde409 === null && declarados.isLoading}
          onClose={() => setElegir(null)}
          onElegir={(contribuyente) => {
            setElegir(null)
            setAbierto({ path: pu(predio, anio, contribuyente) })
          }}
        />
      )}
      {abierto && (
        <PdfDialog
          path={abierto.path}
          titulo={titulo}
          onClose={() => setAbierto(null)}
          onError={(error) => {
            if (error.status !== 409 || error.titulares.length === 0) return
            setAbierto(null)
            setElegir({ desde409: error.titulares })
          }}
        />
      )}
    </>
  )
}

// the ficha del contribuyente's Ver HR, for the year picked
export function VerHr({ contribuyente, codigo, anio }: { contribuyente: string; codigo: string; anio: number }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setAbierto(true)}>
        <FileText className="size-4" />
        Ver HR
      </Button>
      {abierto && (
        <PdfDialog
          path={`/srtm/contribuyentes/${contribuyente}/hr?${new URLSearchParams({ anio: String(anio) })}`}
          titulo={`HR — ${codigo} — ${anio}`}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}

// the PU of one of a contribuyente's predios, as its titular: a row's action
export function PuDeFila({ predio, codigo, contribuyente, anio }: { predio: string; codigo: string; contribuyente: string; anio: number }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button variant="ghost" size="sm" aria-label={`Ver PU de ${codigo}`} onClick={() => setAbierto(true)}>
        <FileText className="size-3.5" />
        PU
      </Button>
      {abierto && <PdfDialog path={pu(predio, anio, contribuyente)} titulo={`PU — ${codigo} — ${anio}`} onClose={() => setAbierto(false)} />}
    </>
  )
}
