// Textos e ajudas das telas do estoque (fora dos componentes).
import { ErroEquipe } from '../api/equipe'
import type { MotivoPerda, Unidade } from '../api/tipos'

export const NOME_MOTIVO: Record<MotivoPerda, string> = {
  ACIDENTE: 'Acidente',
  VALIDADE: 'Validade',
  PREPARO: 'Erro de preparo',
  OUTRO: 'Outro',
}

export const MEDIDAS: { valor: Unidade; nome: string }[] = [
  { valor: 'UN', nome: 'Unidade' },
  { valor: 'G', nome: 'Peso (g, kg)' },
  { valor: 'ML', nome: 'Volume (ml, L)' },
]

/** Recusa do servidor mostra a mensagem dele; o resto é falta de rede. */
export function mensagemDe(erro: unknown): string {
  return erro instanceof ErroEquipe ? erro.message : 'Sem conexão. Tente de novo.'
}
