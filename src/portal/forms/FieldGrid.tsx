import { formatMoney, formatNumber, formatText } from '../components/format'
import type { FieldSpec, SectionSpec } from './specs'

// the read-only side of a ficha: label over value, section by section
export function FieldGrid({ sections, values }: { sections: SectionSpec[]; values: object }) {
  const record = values as Record<string, unknown>
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{section.title}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => (
              <div key={field.name} className={field.wide ? 'sm:col-span-2 lg:col-span-3' : undefined}>
                <dt className="text-xs text-ink-muted">{field.label}</dt>
                <dd className="mt-0.5 text-sm text-ink">{display(field, record[field.name])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function display(field: FieldSpec, value: unknown): string {
  if (field.kind === 'money') return formatMoney(value as number | null)
  if (field.kind === 'decimal') return formatNumber(value as number | null)
  return formatText(value as string | number | null)
}
