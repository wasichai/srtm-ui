// a secuencia de uso as the backend compares it: "1" is "001", and a blank one is the first (srtm-backend's Reglas.kt
// secuenciaUso). two declaraciones of a predio and year are one condominio when theirs read the same
export const secuencia = (valor: string | null | undefined) => {
  const texto = (valor ?? '').trim() || '1'
  return /^\d+$/.test(texto) ? texto.padStart(3, '0') : texto
}
