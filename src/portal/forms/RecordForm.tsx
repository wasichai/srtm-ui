import { ApiError, type FieldViolation } from '@wasichai/core'
import { cn, Label } from '@wasichai/ui'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm, type RegisterOptions, type UseFormReturn } from 'react-hook-form'
import { Button, Input, NativeSelect, Textarea } from '../components/controles'
import { currentYear, formatDate, MESES } from '../components/format'
import { parseGeometry } from '../components/geo'
import { BLOQUEADOS, bloqueados as bloqueadosDe } from './bloqueo'
import { CampoId, useCampoId } from './campoId'
import { etiqueta } from './etiquetas'
import type { Comun, Enlace } from './grupo'
import { dataFields, vacioDe, type FieldSpec, type FormValues, type SectionSpec } from './specs'
import { GRID, SPAN } from './styles'
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
  // edited in place and saved by a button outside it, with other forms (forms/grupo.ts). while it has no changes it
  // follows `initial`: what another tab or the backend changed of the record shows up
  enlace?: Enlace
  // fields that are one value with other forms of the page (forms/grupo.ts): what the clerk sets here goes to them,
  // and theirs comes here
  comun?: Comun
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
  bloqueados,
  enlace,
  comun
}: RecordFormProps<T>) {
  const fields = dataFields(sections)
  const form = useForm<FormValues>({ defaultValues: { ...toForm(fields, initial as Record<string, unknown>), [BLOQUEADOS]: (bloqueados ?? []).join(',') } })
  const {
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = form
  const values = form.watch()
  // a stored record: the backend's codes it lacks are not coming (vacioDe)
  const guardado = Boolean((initial as { id?: unknown }).id)
  const [formError, setFormError] = useState<string | null>(null)
  // its inputs' ids: scoped when it shares the page with other forms (forms/campoId.ts)
  const scope = useId()
  const [campoId] = useState(() => (enlace ? (name: string) => `${scope}field-${name}` : (name: string) => `field-${name}`))
  // what it was loaded with: a field that differs is a change
  const cargados = useRef<FormValues>(toForm(fields, initial as Record<string, unknown>))

  // what the clerk edits and can see: read-only and hidden (`when`) fields keep their value
  const enviados = (current: FormValues) => fields.filter((f) => !f.readOnly && (!f.when || f.when(current)))
  // as they are sent: a field greyed by the one it depends on (`enabledWhen`) goes empty, and so clears what it had
  const aEnviar = (current: FormValues): FormValues =>
    Object.fromEntries(fields.map((f) => [f.name, !f.enabledWhen || f.enabledWhen(current) ? (current[f.name] ?? '') : '']))
  const cambiados = (current: FormValues) => {
    const [ahora, antes] = [aEnviar(current), aEnviar(cargados.current)]
    return enviados(current).filter((f) => ahora[f.name] !== antes[f.name])
  }
  const salida = (current: FormValues) => ({ ...initial, ...fromForm(enviados(current), aEnviar(current)) }) as T
  // the backend names the field it rejects: its message goes under that field, or above the buttons when no control
  // shows it (a hidden field, a geometry, one its `when` hides): see the effect below
  const [delServidor, setDelServidor] = useState<FieldViolation[]>([])
  const mostrarErrores = (e: unknown) => {
    const known = e instanceof ApiError ? e.violations.filter((v) => fields.some((f) => f.name === v.field)) : []
    known.forEach((v) => setError(v.field, { type: 'server', message: v.message }))
    setDelServidor(known)
    return known.length > 0
  }
  const empezar = () => {
    setFormError(null)
    setDelServidor([])
  }
  // once rendered, the ones whose message no control of the form shows (a custom one, as the ubigeo's cascade, shows
  // its hidden fields'): above the buttons, and off their field, where nothing would clear them
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const sinControl = delServidor.filter((v) => !formRef.current?.querySelector(`[id="${campoId(v.field)}-error"]`))
    if (sinControl.length === 0) return
    form.clearErrors(sinControl.map((v) => v.field))
    setFormError(sinControl.map((v) => `${fields.find((f) => f.name === v.field)?.label ?? v.field}: ${v.message}`).join(' · '))
    // only for a new refusal: the helpers above are new every render
  }, [delServidor])

  const submit = handleSubmit(async (current) => {
    empezar()
    try {
      await onSubmit(salida(current))
    } catch (e) {
      if (!mostrarErrores(e)) setFormError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  })

  const pendiente = enlace !== undefined && cambiados(values).length > 0
  // once valid, what `enviar` makes of the values; null while not
  const validos = <R,>(enviar: (current: FormValues) => R) =>
    new Promise<R | null>((resolve) => {
      empezar()
      void handleSubmit(
        (current) => resolve(enviar(current)),
        () => resolve(null)
      )()
    })
  useEffect(() => {
    enlace?.handle?.({
      cambios: () => validos((current) => fromForm(cambiados(current), aEnviar(current))),
      valores: () => validos((current) => salida(current) as Record<string, unknown>),
      errores: mostrarErrores
    })
  })
  useEffect(() => enlace?.cambios?.(pendiente), [enlace, pendiente])
  useEffect(
    () => () => {
      enlace?.handle?.(null)
      enlace?.cambios?.(false)
    },
    [enlace]
  )
  const inicial = JSON.stringify(toForm(fields, initial as Record<string, unknown>))
  useEffect(() => {
    if (!enlace || inicial === JSON.stringify(cargados.current) || cambiados(form.getValues()).length > 0) return
    cargados.current = JSON.parse(inicial) as FormValues
    form.reset({ ...cargados.current, [BLOQUEADOS]: form.getValues(BLOQUEADOS) ?? '' })
    // only for a record read again: the helpers above are new every render
  }, [inicial])

  // a field one with other forms (`comun`): the clerk's change here goes to them, theirs comes here
  const cambiarComun = comun?.cambiar
  const campoComun = comun?.campos
  useEffect(() => {
    if (!cambiarComun || !campoComun) return
    const { unsubscribe } = form.watch((current, { name, type }) => {
      if (type === 'change' && name && campoComun.includes(name)) cambiarComun(name, current[name] ?? '')
    })
    return unsubscribe
  }, [form, cambiarComun, campoComun])
  const deOtros = JSON.stringify(comun?.valores ?? {})
  useEffect(() => {
    for (const [name, value] of Object.entries(JSON.parse(deOtros) as FormValues)) {
      if (fields.some((f) => f.name === name) && (form.getValues(name) ?? '') !== value)
        form.setValue(name, value, { shouldValidate: form.formState.isSubmitted })
    }
    // only when another form changed them: the fields are new every render
  }, [deOtros])

  const contenido = (
    <form ref={formRef} id={formId} onSubmit={submit} noValidate className="space-y-6">
      {children}
      {sections.map((section) => (
        <fieldset key={section.title} data-ui="record-fieldset">
          <legend data-ui="record-legend" className="mb-3 flex w-full items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
            {section.number !== undefined && (
              <span data-ui="record-number" className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">
                {section.number}
              </span>
            )}
            <span data-ui="record-title">{section.title}</span>
            {section.action && (
              <span data-ui="record-action" className="ml-auto font-normal tracking-normal normal-case">
                {section.action(form)}
              </span>
            )}
          </legend>
          <div className={GRID}>
            {section.fields.map((field) => (
              <Field key={field.name} field={field} form={form} values={values} options={options?.[field.name]} guardado={guardado} />
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
  return <CampoId value={campoId}>{contenido}</CampoId>
}

function Field({
  field,
  form,
  values,
  options,
  guardado
}: {
  field: FieldSpec
  form: UseFormReturn<FormValues>
  values: FormValues
  options?: string[]
  guardado: boolean
}) {
  const rules: RegisterOptions<FormValues, string> = {
    validate: (value, all) => validate(field, value ?? '', all),
    onChange: field.onChange && (() => field.onChange?.(form)),
    onBlur: field.onBlur && (() => field.onBlur?.(form))
  }
  const campoId = useCampoId()
  if (field.kind === 'hidden' || field.kind === 'geometry') {
    // no input: a custom field (the ubigeo cascade) writes it. registered so `required` still holds
    form.register(field.name, rules)
    return null
  }
  if (field.when && !field.when(values)) return null
  if (field.kind === 'custom') return <div className={cn(SPAN[field.span ?? 6])}>{field.render?.(form)}</div>

  const id = campoId(field.name)
  const error = form.formState.errors[field.name]?.message
  const enabled = !field.enabledWhen || field.enabledWhen(values)
  const locked = bloqueadosDe(values).includes(field.name) || !!field.lockedWhen?.(values)
  const required = enabled && isRequired(field, values)
  const aria = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined }

  let control: ReactNode
  if (!enabled && !field.readOnly) {
    const shown = field.greyedValue?.(values, form.formState.defaultValues as FormValues) ?? ''
    control = <Input {...aria} disabled value={shown} placeholder={field.kind === 'date' ? 'DD/MM/AAAA' : field.kind === 'enum' ? 'SELECCIONAR' : ''} />
  } else if (field.readOnly || locked) {
    // a locked field is still the form's: registered, so it is validated and sent
    if (locked) form.register(field.name, rules)
    const value = field.kind === 'enum' ? etiqueta(field.name, values[field.name] ?? '') : (values[field.name] ?? '')
    // empty stays empty, so the placeholder ("(AUTOGENERADO)", "SIN CÓDIGO (padrón)") shows instead of a dash
    control = <Input {...aria} disabled value={field.kind === 'date' && value ? formatDate(value) : value} placeholder={vacioDe(field, values, guardado)} />
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
            {etiqueta(field.name, choice)}
          </label>
        ))}
      </div>
    )
  } else if (field.kind === 'enum' || field.kind === 'boolean' || field.kind === 'month' || field.kind === 'year') {
    const choices =
      field.kind === 'boolean'
        ? BOOLEAN_CHOICES
        : field.kind === 'month'
          ? MONTH_CHOICES
          : field.kind === 'year'
            ? yearChoices()
            : (options ?? []).map((o) => ({ value: o, label: etiqueta(field.name, o) }))
    const stored = values[field.name]
    // a value the catalog no longer offers (an imported record) is still shown, not silently dropped
    const all = stored && !choices.some((c) => c.value === stored) ? [{ value: stored, label: etiqueta(field.name, stored) }, ...choices] : choices
    control = (
      <NativeSelect {...aria} {...form.register(field.name, rules)}>
        <option value="">SELECCIONAR</option>
        {all.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
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

// the srtm's años de construcción: this one down to 1900
const yearChoices = () => Array.from({ length: currentYear() - 1899 }, (_, i) => String(currentYear() - i)).map((year) => ({ value: year, label: year }))

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
      if (f.kind === 'integer' || f.kind === 'month' || f.kind === 'year') return [f.name, Number.parseInt(text, 10)]
      if (f.kind === 'decimal' || f.kind === 'money') return [f.name, Number(text.replace(',', '.'))]
      if (f.kind === 'boolean') return [f.name, text === 'true']
      if (f.kind === 'geometry') return [f.name, parseGeometry(text)]
      return [f.name, text]
    })
  )
}
