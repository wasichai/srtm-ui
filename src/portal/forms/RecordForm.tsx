import { ApiError } from '@wasichai/core'
import { Button, cn, Input, Label, Textarea } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useForm, type RegisterOptions, type UseFormReturn } from 'react-hook-form'
import { formatDate, MESES } from '../components/format'
import { parseGeometry } from '../components/geo'
import { BLOQUEADOS, bloqueados as bloqueadosDe } from './bloqueo'
import { dataFields, type FieldSpec, type FormValues, type SectionSpec } from './specs'
import { GRID, selectClass, SPAN } from './styles'
import { SuggestInput } from './SuggestInput'

interface RecordFormProps<T> {
  sections: SectionSpec[]
  // enum options of this entity, by field
  options?: Record<string, string[]>
  initial: T
  submitLabel: string
  onSubmit: (values: T) => Promise<unknown>
  onCancel?: () => void
  cancelLabel?: string
  // above the sections: what the form does not edit itself (a relation picker)
  children?: ReactNode
  // renders the buttons elsewhere (the wizard's header): the form gets this id
  formId?: string
  hideActions?: boolean
  // below the sections, with the live values (the domicilio's address preview)
  footer?: (values: FormValues, form: UseFormReturn<FormValues>) => ReactNode
  // fields that start greyed: what a lote of the catastro filled (forms/bloqueo.ts)
  bloqueados?: string[]
}

// one form for every entity. the backend validates again and names the field it rejects:
// that message lands under the field, anything else above the buttons
export function RecordForm<T extends object>({
  sections,
  options,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = 'Cancelar',
  children,
  formId,
  hideActions,
  footer,
  bloqueados
}: RecordFormProps<T>) {
  const fields = dataFields(sections)
  const form = useForm<FormValues>({ defaultValues: { ...toForm(fields, initial as Record<string, unknown>), [BLOQUEADOS]: (bloqueados ?? []).join(',') } })
  const {
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = form
  const values = form.watch()
  const [formError, setFormError] = useState<string | null>(null)

  const submit = handleSubmit(async (current) => {
    setFormError(null)
    // what the clerk edits and can see: read-only, hidden (`when`) and greyed (`enabledWhen`) fields keep their value
    const sent = fields.filter((f) => !f.readOnly && (!f.when || f.when(current)) && (!f.enabledWhen || f.enabledWhen(current)))
    try {
      await onSubmit({ ...initial, ...fromForm(sent, current) } as T)
    } catch (e) {
      const known = e instanceof ApiError ? e.violations.filter((v) => fields.some((f) => f.name === v.field)) : []
      known.forEach((v) => setError(v.field, { type: 'server', message: v.message }))
      if (known.length === 0) setFormError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  })

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {children}
      {sections.map((section) => (
        <fieldset key={section.title}>
          <legend className="mb-3 flex w-full items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
            {section.number !== undefined && (
              <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">{section.number}</span>
            )}
            {section.title}
            {section.action && <span className="ml-auto font-normal tracking-normal normal-case">{section.action(form)}</span>}
          </legend>
          <div className={GRID}>
            {section.fields.map((field) => (
              <Field key={field.name} field={field} form={form} values={values} options={options?.[field.name]} />
            ))}
          </div>
        </fieldset>
      ))}
      {footer?.(values, form)}
      {formError && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}
      {!hideActions && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

function Field({ field, form, values, options }: { field: FieldSpec; form: UseFormReturn<FormValues>; values: FormValues; options?: string[] }) {
  const rules: RegisterOptions<FormValues, string> = { validate: (value, all) => validate(field, value ?? '', all) }
  if (field.kind === 'hidden' || field.kind === 'geometry') {
    // no input: a custom field (the ubigeo cascade) writes it. registered so `required` still holds
    form.register(field.name, rules)
    return null
  }
  if (field.when && !field.when(values)) return null
  if (field.kind === 'custom') return <div className={cn(SPAN[field.span ?? 6])}>{field.render?.(form)}</div>

  const id = `field-${field.name}`
  const error = form.formState.errors[field.name]?.message
  const enabled = !field.enabledWhen || field.enabledWhen(values)
  const locked = bloqueadosDe(values).includes(field.name)
  const required = enabled && isRequired(field, values)
  const aria = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined }

  let control: ReactNode
  if (!enabled && !field.readOnly) {
    const shown = field.greyedValue?.(values, form.formState.defaultValues as FormValues) ?? ''
    control = <Input {...aria} disabled value={shown} placeholder={field.kind === 'date' ? 'DD/MM/AAAA' : field.kind === 'enum' ? 'SELECCIONAR' : ''} />
  } else if (field.readOnly || locked) {
    // a locked field is still the form's: registered, so it is validated and sent
    if (locked) form.register(field.name, rules)
    const value = values[field.name] ?? ''
    // empty stays empty, so the placeholder ("(AUTOGENERADO)") shows instead of a dash
    control = <Input {...aria} disabled value={field.kind === 'date' && value ? formatDate(value) : value} placeholder={field.placeholder} />
  } else if (field.kind === 'multi') {
    const picked = (values[field.name] ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    form.register(field.name, rules)
    const toggle = (choice: string) => {
      const next = picked.includes(choice) ? picked.filter((p) => p !== choice) : [...picked, choice]
      form.setValue(field.name, next.join(', '), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    }
    control = (
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        aria-invalid={error ? true : undefined}
        className="flex min-h-9 flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-surface px-3 py-1.5 aria-[invalid=true]:border-danger"
      >
        {(field.choices ?? []).map((choice) => (
          <label key={choice} className="flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" checked={picked.includes(choice)} onChange={() => toggle(choice)} className="accent-brand" />
            {choice}
          </label>
        ))}
      </div>
    )
  } else if (field.kind === 'enum' || field.kind === 'boolean' || field.kind === 'month') {
    const choices = field.kind === 'boolean' ? BOOLEAN_CHOICES : field.kind === 'month' ? MONTH_CHOICES : (options ?? []).map((o) => ({ value: o, label: o }))
    const stored = values[field.name]
    // a value the catalog no longer offers (an imported record) is still shown, not silently dropped
    const all = stored && !choices.some((c) => c.value === stored) ? [{ value: stored, label: stored }, ...choices] : choices
    control = (
      <select {...aria} {...form.register(field.name, rules)} className={selectClass}>
        <option value="">SELECCIONAR</option>
        {all.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    )
  } else if (field.kind === 'longtext') {
    control = <Textarea {...aria} {...form.register(field.name, rules)} placeholder={field.placeholder} rows={2} />
  } else if (field.kind === 'suggest' && field.suggest) {
    const suggest = field.suggest
    control = (
      <SuggestInput
        {...aria}
        {...form.register(field.name, rules)}
        value={values[field.name] ?? ''}
        placeholder={field.placeholder}
        queryKey={[field.name, values.tipo_via, values.tipo_unidad_urbana, values.tipo_zona, values.ubigeo]}
        fetch={(q) => suggest(q, form.getValues())}
      />
    )
  } else {
    const type = field.kind === 'date' ? 'date' : 'text'
    const numeric = field.kind === 'integer' || field.kind === 'decimal' || field.kind === 'money'
    control = <Input {...aria} {...form.register(field.name, rules)} type={type} inputMode={numeric ? 'decimal' : undefined} placeholder={field.placeholder} />
  }

  return (
    <div className={cn('space-y-1.5', SPAN[field.span ?? 2])}>
      {/* one line, whatever the label's length: the inputs of a row stay aligned, as in the srtm */}
      <Label htmlFor={id} id={`${id}-label`} title={field.label} className="block truncate">
        {field.label}
        {required && !field.readOnly && <span className="text-danger"> *</span>}
      </Label>
      {control}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const MONTH_CHOICES = MESES.map((label, i) => ({ value: String(i + 1), label }))

const BOOLEAN_CHOICES = [
  { value: 'true', label: 'SÍ' },
  { value: 'false', label: 'NO' }
]

function isRequired(field: FieldSpec, values: FormValues): boolean {
  return typeof field.required === 'function' ? field.required(values) : field.required === true
}

function validate(field: FieldSpec, value: string, values: FormValues): true | string {
  if (field.readOnly || (field.when && !field.when(values)) || (field.enabledWhen && !field.enabledWhen(values))) return true
  const text = value.trim()
  if (!text) return isRequired(field, values) ? 'Este dato es obligatorio' : true
  if (field.kind === 'integer') return /^-?\d+$/.test(text) || 'Debe ser un número entero'
  if (field.kind === 'decimal' || field.kind === 'money') return /^-?\d+([.,]\d+)?$/.test(text) || 'Debe ser un número'
  return field.validate ? field.validate(text, values) : true
}

function toForm(fields: FieldSpec[], values: Record<string, unknown>): FormValues {
  return Object.fromEntries(
    fields.map((f) => {
      const value = values[f.name]
      if (value === null || value === undefined) return [f.name, '']
      // a geometry rides in its hidden field as geojson text
      return [f.name, f.kind === 'geometry' ? JSON.stringify(value) : String(value)]
    })
  )
}

// blanks go back as null: the backend then clears the field instead of keeping the old value
function fromForm(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => {
      const text = (values[f.name] ?? '').trim()
      if (text === '') return [f.name, null]
      if (f.kind === 'integer' || f.kind === 'month') return [f.name, Number.parseInt(text, 10)]
      if (f.kind === 'decimal' || f.kind === 'money') return [f.name, Number(text.replace(',', '.'))]
      if (f.kind === 'boolean') return [f.name, text === 'true']
      if (f.kind === 'geometry') return [f.name, parseGeometry(text)]
      return [f.name, text]
    })
  )
}
