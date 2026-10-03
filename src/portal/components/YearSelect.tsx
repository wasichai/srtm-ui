import { currentYear, recentYears } from './format'

// siguiente puts next year first: what is loaded ahead of it (plazos, tasas) is checked before it applies
export function YearSelect({ value, onChange, siguiente = false }: { value: number; onChange: (year: number) => void; siguiente?: boolean }) {
  const years = siguiente ? [currentYear() + 1, ...recentYears()] : recentYears()
  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      Año
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink">
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  )
}
