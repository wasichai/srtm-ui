// how the visor writes amounts, areas and counts, as catastro-ui's visor does, so both read the same figures alike
export type Monto = number | string | null | undefined

export interface OpcionesSoles {
  // decimals shown: 2 by default; the legend of the Δ uses whole soles
  minimo?: number
  maximo?: number
  // a leading + on positive amounts, for differences
  signo?: boolean
}

const numero = (v: Monto): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// «S/ 1,234.50», «−S/ 50.00», or «+S/ 50» with signo; «—» when there is no number. the space after «S/» is a
// no-break one, so a narrow card never leaves «S/» on one line and the number on the next
export function soles(v: Monto, { minimo = 2, maximo = Math.max(2, minimo), signo = false }: OpcionesSoles = {}): string {
  const n = numero(v)
  if (n === null) return '—'
  const cuerpo = `S/ ${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: minimo, maximumFractionDigits: maximo })}`
  // rounding may turn a tiny negative into zero: no sign then
  const cero = Number(Math.abs(n).toFixed(maximo)) === 0
  if (n < 0 && !cero) return `−${cuerpo}`
  return signo && n > 0 && !cero ? `+${cuerpo}` : cuerpo
}

// «95.25 m²», «+15.25 m²» with signo, «—» when there is no number
export function metros(v: Monto, { signo = false }: { signo?: boolean } = {}): string {
  const n = numero(v)
  if (n === null) return '—'
  const cuerpo = `${Math.abs(n).toLocaleString('es-PE', { maximumFractionDigits: 2 })} m²`
  const cero = Number(Math.abs(n).toFixed(2)) === 0
  if (n < 0 && !cero) return `−${cuerpo}`
  return signo && n > 0 && !cero ? `+${cuerpo}` : cuerpo
}

export const cantidad = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('es-PE') : '—')

// «1 ficha», «3 fichas»
export const plural = (n: number, uno: string, varios: string) => `${cantidad(n)} ${n === 1 ? uno : varios}`
