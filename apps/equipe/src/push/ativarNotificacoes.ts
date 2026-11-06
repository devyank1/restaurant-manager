// Web Push do garçom: pede permissão (só num clique), assina com a chave
// VAPID da API e manda a inscrição. Só funciona em HTTPS (ou localhost).
import { chavePush, inscreverPush } from '../api/equipe'

export type ResultadoPush = 'ativado' | 'negado' | 'sem-suporte' | 'sem-chave'
export type EstadoPush = 'ativado' | 'negado' | 'sem-suporte' | 'pendente'

function temSuporte(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Como está agora, sem pedir nada ao navegador. */
export function estadoNotificacoes(): EstadoPush {
  if (!temSuporte()) return 'sem-suporte'
  if (Notification.permission === 'granted') return 'ativado'
  if (Notification.permission === 'denied') return 'negado'
  return 'pendente'
}

/** Chave VAPID (base64url) nos bytes que o PushManager espera. */
export function chaveParaBytes(chave: string): Uint8Array<ArrayBuffer> {
  const base64 = chave.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(chave.length / 4) * 4, '=')
  const binario = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/**
 * Liga as notificações deste celular. Chamar de um clique na primeira vez
 * (o navegador exige). Com permissão já dada, pode chamar sozinho: reenvia a
 * inscrição atual (a API faz upsert pelo endpoint).
 */
export async function ativarNotificacoes(): Promise<ResultadoPush> {
  if (!temSuporte()) return 'sem-suporte'
  const { chavePublica } = await chavePush()
  if (!chavePublica) return 'sem-chave'
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return 'negado'
  const registro = await navigator.serviceWorker.ready
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) }))
  await inscreverPush(inscricao.toJSON())
  return 'ativado'
}
