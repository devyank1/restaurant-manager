/** "agora", "há 5 min", "há 2 h" desde `criadoEm`. */
export function haQuanto(criadoEm: string, agora = Date.now()): string {
  const minutos = Math.floor((agora - new Date(criadoEm).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  return `há ${Math.floor(minutos / 60)} h`
}
