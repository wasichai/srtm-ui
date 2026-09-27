export type Tono = 'rojo' | 'ambar' | 'verde' | ''

// the prototype's tono(): red first, as its words hold green ones (inactivo holds activo, no habido holds habido).
// anulad(a) is the srtm's own red; accents are dropped, so "en tramite" reads like "en trámite"
const ROJO = /vencida|coactiva|denegado|inactivo|no habido|baja|anulad/
const AMBAR = /por vencer|en tramite|observ/
const VERDE = /activo|habido|vigente|cancelada|conforme/

// the tone of a situación, estado or condición: how the portal-tributario theme colours it
export function tonoDeEstado(texto: string | null | undefined): Tono {
  const t = (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  if (ROJO.test(t)) return 'rojo'
  if (AMBAR.test(t)) return 'ambar'
  if (VERDE.test(t)) return 'verde'
  return ''
}
