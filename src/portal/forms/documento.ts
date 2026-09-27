// the number each tipo de documento takes, as sunat and reniec write them. the backend checks the same
// (errorDocumento in srtm-backend's Reglas.kt): change both together

export const SIN_DOCUMENTO = 'SIN DOCUMENTO'

// the number is asked once a tipo is chosen, and never for SIN DOCUMENTO
export const pideNumero = (tipo: string | null | undefined) => !!tipo && tipo !== SIN_DOCUMENTO

const RUC_PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

// sunat's modulo 11 over the first ten digits: 11 - sum % 11, where 10 is written 0 and 11 is written 1
const digitoVerificadorRuc = (ruc: string) => (11 - (RUC_PESOS.reduce((sum, peso, i) => sum + Number(ruc[i]) * peso, 0) % 11)) % 10

// null when the number fits its tipo, the reason otherwise
export function errorDocumento(tipo: string | null | undefined, numero: string | null | undefined): string | null {
  if (!pideNumero(tipo)) return null
  const n = (numero ?? '').trim()
  if (!n) return 'Este dato es obligatorio'
  if (tipo === 'DNI') return /^\d{8}$/.test(n) ? null : 'El DNI tiene 8 dígitos'
  if (tipo === 'RUC') {
    if (!/^(10|15|16|17|20)\d{9}$/.test(n)) return 'El RUC tiene 11 dígitos y empieza con 10, 15, 16, 17 o 20'
    return digitoVerificadorRuc(n) === Number(n[10]) ? null : 'El dígito verificador del RUC no es válido'
  }
  return /^[A-Za-z0-9]{1,12}$/.test(n) ? null : 'Hasta 12 letras o dígitos'
}
