/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // App da equipe: porta fixa (o cliente redireciona 5173 → 5174).
    port: 5174,
    strictPort: true,
    // Permite abrir no celular pela rede local.
    host: true,
    // HTTPS do Tailscale (tailscale serve) chega com host *.ts.net.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
      // Tempo real da equipe (socket.io), com upgrade para WebSocket.
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
