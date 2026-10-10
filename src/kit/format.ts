const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

export const formatMoney = (value: number | null | undefined) => (value === null || value === undefined ? '—' : money.format(value))
export const formatNumber = (value: number | null | undefined) => (value === null || value === undefined ? '—' : number.format(value))
export const formatText = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : String(value))

// a figure as typed, read the way formatNumber writes it (es-PE): a point before the decimals and, if any, commas
// between thousands (1,250.50). a comma before decimals (1,5) is refused, not guessed: read as thousands it would be
// another figure. null when the text is not one
const DECIMAL = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/
const INTEGER = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)$/
export const parseNumber = (text: string, { integer = false }: { integer?: boolean } = {}): number | null => {
  const trimmed = text.trim()
  return (integer ? INTEGER : DECIMAL).test(trimmed) ? Number(trimmed.replaceAll(',', '')) : null
}

export const currentYear = () => new Date().getFullYear()

// an instant (a record's last update) is on the day it was in Lima, not in UTC: at night there it is already tomorrow
const LIMA = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/

// iso date (what the backend and <input type=date> use) or instant -> DD/MM/YYYY
export const formatDate = (value: string | null | undefined) => {
  if (value && INSTANT.test(value)) {
    const parts = Object.fromEntries(LIMA.formatToParts(new Date(value)).map((p) => [p.type, p.value]))
    return `${parts.day}/${parts.month}/${parts.year}`
  }
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
  return match ? `${match[3]}/${match[2]}/${match[1]}` : formatText(value)
}
