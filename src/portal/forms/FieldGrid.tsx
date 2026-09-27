import { cn } from '@wasichai/ui'
import { formatDate, formatMoney, formatNumber, formatText, MESES } from '../components/format'
import { AUTO, vacioDe, type FieldSpec, type FormValues, type SectionSpec } from './specs'
import { GRID, SPAN } from './styles'

// the read-only side of a ficha: label over value, section by section, on the same grid as the form
export function FieldGrid({ sections, values }: { sections: SectionSpec[]; values: object }) {
  const record = values as Record<string, unknown>
  const asForm = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])) as FormValues
  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const shown = section.fields.filter((f) => f.kind !== 'hidden' && f.kind !== 'geometry' && f.kind !== 'custom' && (!f.when || f.when(asForm)))
        if (shown.length === 0) return null
        return (
          <section key={section.title}>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
              {section.number !== undefined && (
                <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">{section.number}</span>
              )}
              {section.title}
            </h3>
            <dl className={GRID}>
              {shown.map((field) => (
                <div key={field.name} className={cn(SPAN[field.span ?? 2])}>
                  <dt className="text-xs text-ink-muted">{field.label}</dt>
                  <dd className="mt-0.5 text-sm break-words text-ink">{display(field, record[field.name], asForm)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

function display(field: FieldSpec, value: unknown, values: FormValues): string {
  // a stored record without the backend's code: it is not coming
  if (field.placeholder === AUTO && (value === null || value === undefined || value === '')) return vacioDe(field, values, true) ?? '—'
  if (field.kind === 'money') return formatMoney(value as number | null)
  if (field.kind === 'decimal') return formatNumber(value as number | null)
  if (field.kind === 'date') return formatDate(value as string | null)
  if (field.kind === 'month') return typeof value === 'number' ? (MESES[value - 1] ?? String(value)) : '—'
  if (field.kind === 'boolean') return value === true ? 'SÍ' : value === false ? 'NO' : '—'
  return formatText(value as string | number | null)
}
