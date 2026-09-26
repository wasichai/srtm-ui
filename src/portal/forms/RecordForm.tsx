import { ApiError } from '@wasichai/core'
import { Button, cn, Input, Label } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldSpec, SectionSpec } from './specs'

type FormValues = Record<string, string>

interface RecordFormProps<T> {
  sections: SectionSpec[]
  // enum options of this entity, by field
  options?: Record<string, string[]>
  initial: T
  submitLabel: string
  onSubmit: (values: T) => Promise<unknown>
  onCancel?: () => void
  // above the sections: what the form does not edit itself (a relation picker)
  children?: ReactNode
}

// one form for the three entities. the backend validates again and names the field it rejects:
// that message lands under the field, anything else above the buttons
export function RecordForm<T extends object>({ sections, options, initial, submitLabel, onSubmit, onCancel, children }: RecordFormProps<T>) {
  const fields = sections.flatMap((s) => s.fields)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ defaultValues: toForm(fields, initial as Record<string, unknown>) })
  const [formError, setFormError] = useState<string | null>(null)

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit({ ...initial, ...fromForm(fields, values) } as T)
    } catch (e) {
      const known = e instanceof ApiError ? e.violations.filter((v) => fields.some((f) => f.name === v.field)) : []
      known.forEach((v) => setError(v.field, { type: 'server', message: v.message }))
      if (known.length === 0) setFormError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {children}
      {sections.map((section) => (
        <fieldset key={section.title}>
          <legend className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{section.title}</legend>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => {
              const id = `field-${field.name}`
              const error = errors[field.name]?.message
              const props = {
                id,
                'aria-invalid': error ? true : undefined,
                'aria-describedby': error ? `${id}-error` : undefined,
                ...register(field.name, {
                  required: field.required ? 'Este dato es obligatorio' : false,
                  validate: (value: string) => validNumber(field, value)
                })
              }
              return (
                <div key={field.name} className={cn('space-y-1.5', field.wide && 'sm:col-span-2 lg:col-span-3')}>
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required && <span className="text-danger"> *</span>}
                  </Label>
                  {field.kind === 'enum' ? (
                    <select
                      {...props}
                      className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink aria-[invalid=true]:border-danger"
                    >
                      <option value="">—</option>
                      {(options?.[field.name] ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input {...props} inputMode={field.kind && field.kind !== 'text' ? 'decimal' : undefined} />
                  )}
                  {error && (
                    <p id={`${id}-error`} className="text-xs text-danger">
                      {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
      {formError && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function toForm(fields: FieldSpec[], values: Record<string, unknown>): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, values[f.name] === null || values[f.name] === undefined ? '' : String(values[f.name])]))
}

// blanks go back as null: the backend then clears the field instead of keeping the old value
function fromForm(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => {
      const text = (values[f.name] ?? '').trim()
      if (text === '') return [f.name, null]
      if (f.kind === 'integer') return [f.name, Number.parseInt(text, 10)]
      if (f.kind === 'decimal' || f.kind === 'money') return [f.name, Number(text.replace(',', '.'))]
      return [f.name, text]
    })
  )
}

function validNumber(field: FieldSpec, value: string): true | string {
  const text = value.trim()
  if (!text || !field.kind || field.kind === 'text' || field.kind === 'enum') return true
  if (field.kind === 'integer') return /^-?\d+$/.test(text) || 'Debe ser un número entero'
  return /^-?\d+([.,]\d+)?$/.test(text) || 'Debe ser un número'
}
