import { Button } from '@wasichai/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { selectClass } from '../forms/styles'

const TAMANOS = [5, 10, 25]

// the srtm's table footer: "Filas [10]" on the left, "1 a 10 de 47 registros  < >" on the right ("registros" for
// one too, as the srtm writes it)
export function Paginador({
  page,
  size,
  total,
  onPage,
  onSize
}: {
  page: number
  size: number
  total: number
  onPage: (page: number) => void
  onSize: (size: number) => void
}) {
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min(total, (page + 1) * size)
  const last = Math.max(0, Math.ceil(total / size) - 1)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm text-ink-muted">
      <label className="flex items-center gap-2">
        Filas
        <select value={size} onChange={(e) => onSize(Number(e.target.value))} className={`${selectClass} h-8 w-20`}>
          {TAMANOS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <span>
          {from} a {to} de {total.toLocaleString('es-PE')} registros
        </span>
        <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Página siguiente" disabled={page >= last} onClick={() => onPage(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
