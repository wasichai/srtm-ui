import { Button } from '@wasichai/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  page,
  totalPages,
  totalElements,
  onPage
}: {
  page: number
  totalPages: number
  totalElements: number
  onPage: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm text-ink-muted">
      <span>
        {totalElements.toLocaleString('es-PE')} {totalElements === 1 ? 'registro' : 'registros'}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="secondary" size="icon" aria-label="Página anterior" disabled={page === 0} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Página siguiente" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
