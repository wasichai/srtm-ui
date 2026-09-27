// hands a file to the browser to save, under its name: a link to the blob, clicked once and let go
export function guardarArchivo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = filename
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // the browser has taken the file by the next task
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
