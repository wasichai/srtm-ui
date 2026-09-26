const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

export const formatMoney = (value: number | null | undefined) => (value === null || value === undefined ? '—' : money.format(value))
export const formatNumber = (value: number | null | undefined) => (value === null || value === undefined ? '—' : number.format(value))
export const formatText = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : String(value))

export const currentYear = () => new Date().getFullYear()
// the years a clerk picks from: this one and the four before
export const recentYears = () => Array.from({ length: 5 }, (_, i) => currentYear() - i)
