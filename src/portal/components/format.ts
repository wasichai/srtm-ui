const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

export const formatMoney = (value: number | null | undefined) => (value === null || value === undefined ? '—' : money.format(value))
export const formatNumber = (value: number | null | undefined) => (value === null || value === undefined ? '—' : number.format(value))
export const formatText = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : String(value))

export const currentYear = () => new Date().getFullYear()
// the years a clerk picks from: this one and the four before
export const recentYears = () => Array.from({ length: 5 }, (_, i) => currentYear() - i)

// an instant (a record's last update) is on the day it was in Perú, not in UTC: at night there it is already tomorrow
const LIMA = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/

// iso date (what the backend and <input type=date> use) or instant -> DD/MM/YYYY, as the srtm shows it
export const formatDate = (value: string | null | undefined) => {
  if (value && INSTANT.test(value)) {
    const parts = Object.fromEntries(LIMA.formatToParts(new Date(value)).map((p) => [p.type, p.value]))
    return `${parts.day}/${parts.month}/${parts.year}`
  }
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
  return match ? `${match[3]}/${match[2]}/${match[1]}` : formatText(value)
}

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
