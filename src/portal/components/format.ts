import { currentYear } from '../../kit/format'

// the kit's, for the portal's importers
export { currentYear, formatDate, formatMoney, formatNumber, formatText } from '../../kit/format'

// the years a clerk picks from: this one and the four before
export const recentYears = () => Array.from({ length: 5 }, (_, i) => currentYear() - i)

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
