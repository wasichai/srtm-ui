import { useQuery } from '@tanstack/react-query'
import { Label } from '@wasichai/ui'
import { Check, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/controles'
import type { Pagina } from '../types'

export interface Picked {
  id: string
  label: string
}

interface RecordPickerProps<T> {
  label: string
  placeholder: string
  value: Picked | null
  onChange: (picked: Picked) => void
  search: (q: string) => Promise<Pagina<T>>
  describe: (record: T) => Picked
  error?: string
}

// search-as-you-type for a contribuyente: the titular of a declaration opened from a predio, or a condómino
export function RecordPicker<T>({ label, placeholder, value, onChange, search, describe, error }: RecordPickerProps<T>) {
  const [editing, setEditing] = useState(value === null)
  const [q, setQ] = useState('')
  const term = q.trim()
  const results = useQuery({ queryKey: ['picker', label, term], queryFn: () => search(term), enabled: editing && term.length >= 2 })

  if (!editing && value) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Check className="size-4 text-success" />
            {value.label}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Cambiar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="picker">
        {label} <span className="text-danger">*</span>
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id="picker"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm aria-[invalid=true]:border-danger"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {term.length >= 2 && (
        <ul aria-label={`Resultados de ${label.toLowerCase()}`} className="max-h-48 overflow-y-auto rounded-md border border-border bg-surface text-sm">
          {results.isPending && <li className="px-3 py-2 text-ink-muted">Buscando…</li>}
          {results.data?.content.length === 0 && <li className="px-3 py-2 text-ink-muted">Sin resultados</li>}
          {results.data?.content.map((record) => {
            const picked = describe(record)
            return (
              <li key={picked.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-brand-soft"
                  onClick={() => {
                    onChange(picked)
                    setEditing(false)
                  }}
                >
                  {picked.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
