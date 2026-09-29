import type { UseFormReturn } from 'react-hook-form'
import type { FieldSpec, FormValues } from '../../kit/forms/spec'
import { rentas } from '../api'
import type { DatosPersona } from '../types'
import { errorDocumento } from './documento'

// PIDE RENIEC (pages 3, 8 and 15): leaving the DNI of a contribuyente, a relacionado or a transferente asks RENIEC,
// through the backend. its names fill apellidos and nombres, greyed, with fuente PIDE RENIEC (greyed too); without an
// answer (no convenio, an unknown DNI, a failure) they are typed, with fuente MANUAL. the backend takes PIDE RENIEC only
// after that consulta and with the same names (srtm-backend's ConsultasReniec)

export const PIDE_RENIEC = 'PIDE RENIEC'
const MANUAL = 'MANUAL'
const NOMBRES = ['apellido_paterno', 'apellido_materno', 'nombres'] as const

// the number last asked, until the document changes: leaving the field again asks nothing (every consulta costs).
// it rides in the form's values under a name no field has, so it is never sent (as the kit's forms/locked.ts list)
const PEDIDO = '__reniec'

type Form = UseFormReturn<FormValues>

// the names and the fuente are RENIEC's: greyed, and sent as they are
export const deReniec = (v: FormValues) => v.fuente_informacion === PIDE_RENIEC

const documento = (v: FormValues) => ({ tipo: v.tipo_documento ?? '', numero: (v.numero_documento ?? '').trim() })

const manual = (form: Form) => form.setValue('fuente_informacion', MANUAL, { shouldDirty: true })

async function consultar(form: Form) {
  const { tipo, numero } = documento(form.getValues())
  if (tipo !== 'DNI' || errorDocumento(tipo, numero)) return manual(form)
  form.setValue(PEDIDO, numero)
  let persona: DatosPersona | null = null
  try {
    persona = await rentas.consultarDocumento(tipo, numero)
  } catch {
    // a 404 or a failure: the clerk types the names
  }
  // the clerk changed the document meanwhile: this answer is not its
  const ahora = documento(form.getValues())
  if (ahora.tipo !== tipo || ahora.numero !== numero) return
  if (!persona) return manual(form)
  for (const name of NOMBRES) form.setValue(name, persona[name] ?? '', { shouldDirty: true })
  form.setValue('fuente_informacion', PIDE_RENIEC, { shouldDirty: true })
  form.clearErrors([...NOMBRES, 'fuente_informacion'])
}

// leaving the N° documento: a DNI not yet asked is. the stored one is not (an edit keeps what it has): to ask it,
// choose PIDE RENIEC
function alSalirDelNumero(form: Form) {
  const v = form.getValues()
  const { tipo, numero } = documento(v)
  if (tipo !== 'DNI' || errorDocumento(tipo, numero) || deReniec(v)) return
  if (numero === v[PEDIDO] || numero === (form.formState.defaultValues?.numero_documento ?? '').trim()) return
  void consultar(form)
}

// another document is not the one RENIEC answered for: the names are the clerk's again
function alCambiarDocumento(form: Form) {
  form.setValue(PEDIDO, '')
  if (deReniec(form.getValues())) manual(form)
}

// PIDE RENIEC chosen by hand asks RENIEC: without its answer, back to MANUAL
function alElegirFuente(form: Form) {
  if (deReniec(form.getValues())) void consultar(form)
}

// what each field of the document and the names does, in the three forms
export const RENIEC = {
  tipo: { onChange: alCambiarDocumento },
  numero: { onChange: alCambiarDocumento, onBlur: alSalirDelNumero },
  fuente: { lockedWhen: deReniec, onChange: alElegirFuente },
  nombre: { lockedWhen: deReniec }
} satisfies Record<string, Partial<FieldSpec>>
