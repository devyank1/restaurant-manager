export function extrairToken(pathname: string): string | null {
  const encontrado = /^\/m\/([^/]+)\/?$/.exec(pathname)
  return encontrado ? decodeURIComponent(encontrado[1]) : null
}
