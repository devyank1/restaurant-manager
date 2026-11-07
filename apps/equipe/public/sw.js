// Service worker do app da equipe: só Web Push (sem cache offline nesta etapa).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

// A API manda { titulo, corpo, url } (apps/api/src/push/push.service.ts).
self.addEventListener('push', (evento) => {
  let msg = { titulo: 'Equipe', corpo: '', url: '/' }
  try {
    msg = { ...msg, ...evento.data.json() }
  } catch {
    // Push sem corpo JSON: mostra o padrão.
  }
  evento.waitUntil(
    self.registration.showNotification(msg.titulo, {
      body: msg.corpo,
      icon: '/icone-192.png',
      badge: '/icone-192.png',
      tag: msg.url,
      renotify: true,
      data: { url: msg.url },
    }),
  )
})

// Toque na notificação: foca uma janela aberta do app e pede para ela ir à
// mesa (sem recarregar: não perde nada aberto). Sem janela, ou se algo falhar
// (ex.: janela não controlada), abre uma nova.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const caminho = (evento.notification.data && evento.notification.data.url) || '/'
  const url = new URL(caminho, self.location.origin).href
  const abrirNova = () => self.clients.openWindow(url)
  evento.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => {
        const janela = janelas.find((j) => new URL(j.url).origin === self.location.origin)
        if (!janela) return abrirNova()
        return janela.focus().then((focada) => (focada || janela).postMessage({ tipo: 'abrir', url: caminho }))
      })
      .catch(abrirNova),
  )
})
