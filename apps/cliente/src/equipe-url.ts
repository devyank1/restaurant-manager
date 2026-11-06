type Local = { protocol: string; hostname: string; port: string }

/**
 * Endereço do app da equipe no mesmo host: dev 5173 → 5174;
 * HTTPS padrão (Tailscale) → 8443. `VITE_EQUIPE_URL` sobrepõe.
 */
export function urlEquipe(loc: Local, sobrepor: string | undefined = import.meta.env.VITE_EQUIPE_URL): string {
  if (sobrepor) return sobrepor.replace(/\/+$/, '')
  const porta = loc.port === '' || loc.port === '443' ? '8443' : '5174'
  return `${loc.protocol}//${loc.hostname}:${porta}`
}
