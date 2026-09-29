// Default Spanish strings for kit forms and flows
export interface KitTexts {
  required: string // 'Este dato es obligatorio'
  integer: string // 'Debe ser un número entero'
  number: string // 'Debe ser un número'
  saving: string // 'Guardando…'
  saveFailed: string // 'No se pudo guardar'
  cancel: string // 'Cancelar'
  select: string // 'SELECCIONAR'
  datePlaceholder: string // 'DD/MM/AAAA'
  yes: string // 'SÍ'
  no: string // 'NO'
  months: readonly string[] // ENERO … DICIEMBRE (SETIEMBRE)
  leaveTitle: string // '¿Salir sin guardar?'
  leaveConsequence: string // 'Si sales, se pierden.'
  leaveConfirm: string // 'Salir sin guardar'
  keepEditing: string // 'Seguir editando'
  pendingIn: (list: string) => string // list joined: 'Hay cambios sin guardar en A, B.'
}

export const DEFAULT_TEXTS: KitTexts = {
  required: 'Este dato es obligatorio',
  integer: 'Debe ser un número entero',
  number: 'Debe ser un número',
  saving: 'Guardando…',
  saveFailed: 'No se pudo guardar',
  cancel: 'Cancelar',
  select: 'SELECCIONAR',
  datePlaceholder: 'DD/MM/AAAA',
  yes: 'SÍ',
  no: 'NO',
  months: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'],
  leaveTitle: '¿Salir sin guardar?',
  leaveConsequence: 'Si sales, se pierden.',
  leaveConfirm: 'Salir sin guardar',
  keepEditing: 'Seguir editando',
  pendingIn: (list) => `Hay cambios sin guardar en ${list}.`
}
