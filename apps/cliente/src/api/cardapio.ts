import type { CardapioPublico } from './tipos'

export class ErroMesaNaoEncontrada extends Error {}
export class ErroRede extends Error {}

export async function buscarCardapio(token: string): Promise<CardapioPublico> {
  let resposta: Response
  try {
    resposta = await fetch(`/api/publico/mesas/${encodeURIComponent(token)}/cardapio`)
  } catch (erro) {
    throw new ErroRede(String(erro))
  }
  // 400 vem do servidor recusando um token malformado: para o cliente é a mesma coisa.
  if (resposta.status === 404 || resposta.status === 400) throw new ErroMesaNaoEncontrada()
  if (!resposta.ok) throw new ErroRede(`HTTP ${resposta.status}`)
  return (await resposta.json()) as CardapioPublico
}
