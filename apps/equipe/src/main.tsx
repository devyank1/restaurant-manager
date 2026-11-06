import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { navegar } from './rotas'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker só para Web Push (precisa de HTTPS ou localhost).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}

// Toque numa notificação com o app já aberto: o service worker pede a rota.
navigator.serviceWorker?.addEventListener('message', (evento: MessageEvent<{ tipo?: string; url?: string }>) => {
  const { tipo, url } = evento.data ?? {}
  if (tipo === 'abrir' && url?.startsWith('/') && !url.startsWith('//')) navegar(url)
})
