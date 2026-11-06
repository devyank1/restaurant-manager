/** Lê o header Cookie (handshake do socket, onde não há cookie-parser). */
export function lerCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const parte of (header ?? '').split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    const nome = parte.slice(0, igual).trim();
    const valor = parte.slice(igual + 1).trim();
    try {
      cookies[nome] = decodeURIComponent(valor);
    } catch {
      cookies[nome] = valor;
    }
  }
  return cookies;
}
