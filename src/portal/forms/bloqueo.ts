import type { UseFormReturn } from 'react-hook-form'
import type { FormValues } from './specs'

// fields filled from elsewhere (a lote of the catastro fiscal, page 14): greyed and sent as they are, until the clerk
// unlocks them. the list rides in the form's own values, under a name no field has, so it is never sent
export const BLOQUEADOS = '__bloqueados'

export const bloqueados = (values: FormValues): string[] => (values[BLOQUEADOS] ?? '').split(',').filter(Boolean)

export const bloquear = (form: UseFormReturn<FormValues>, names: string[]) => form.setValue(BLOQUEADOS, names.join(','))

export const desbloquear = (form: UseFormReturn<FormValues>) => bloquear(form, [])

// for the form's own widgets (the ubigeo cascade, the map), while rendering: watched, so a change re-renders them
export const bloqueadosEn = (form: UseFormReturn<FormValues>): string[] => bloqueados({ [BLOQUEADOS]: form.watch(BLOQUEADOS) ?? '' })
