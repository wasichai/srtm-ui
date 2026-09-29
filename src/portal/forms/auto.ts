import type { FormValues, PlaceholderContext } from '../../kit/forms/spec'

// the backend's code, number or date, which only a new record is promised
export const AUTO = '(AUTOGENERADO)'
// what such a field shows once its record exists without it: one imported from the padrón, never numbered
export const SIN_CODIGO = 'SIN CÓDIGO (padrón)'
export const SIN_FECHA = 'SIN FECHA (padrón)'

// the placeholder of such a field: AUTO while its record is new, SIN FECHA or SIN CÓDIGO once it is stored without
// it. exists: a field of another record shown beside the form's (the predio's in datos del predio) says whether that
// record exists; without it, the form's own record decides
export function auto(opts: { exists?: (v: FormValues) => boolean; date?: boolean } = {}): (ctx: PlaceholderContext) => string {
  return ({ values, saved }) => {
    if (!(opts.exists ? opts.exists(values) : saved)) return AUTO
    return opts.date ? SIN_FECHA : SIN_CODIGO
  }
}
