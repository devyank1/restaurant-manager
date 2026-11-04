export function extrairToken(pathname: string): string | null {
  const encontrado = /^\/m\/([^/]+)\/?$/.exec(pathname)
  if (!encontrado) return null
  try {
    return decodeURIComponent(encontrado[1])
  } catch {
    // `%` malformado (etiqueta gravada pela metade, URL editada à mão).
    return null
  }
}
