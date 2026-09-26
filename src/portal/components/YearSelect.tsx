import { recentYears } from './format'

export function YearSelect({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      Año
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink">
        {recentYears().map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  )
}
