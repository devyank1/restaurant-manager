// Espelho dos tipos da API da equipe (apps/api/src/equipe, chamados, rodadas) — manter em sincronia.
import type { Selecao } from '@cardapio/opcoes'

export type Papel = 'DONO' | 'GARCOM' | 'COZINHA'

export type UsuarioEquipe = {
  id: string
  nome: string
  papel: Papel
  emTurno: boolean
}

export type ChamadoEquipe = {
  id: string
  tipo: 'ATENDENTE' | 'CONFIRMAR_RODADA'
  status: 'ABERTO' | 'LIDO' | 'RESOLVIDO'
  mesa: { numero: number; token: string }
  criadoEm: string
  paraTodos: boolean
  tentativas: number
}

export type MesaResumo = {
  numero: number
  token: string
  aberta: boolean
  garcomNome: string | null
  /** Rodadas aguardando garçom. */
  pendentes: number
}

export type StatusRodada = 'AGUARDANDO_GARCOM' | 'CONFIRMADA' | 'CANCELADA'

export type ItemRodadaEquipe = {
  id: string
  pratoId: string
  nome: string
  resumoOpcoes: string
  selecao: Selecao
  observacao: string
  quantidade: number
  precoUnitarioCentavos: number
}

export type RodadaEquipe = {
  id: string
  status: StatusRodada
  criadoEm: string
  totalCentavos: number
  /** Celular que ainda não teve rodada confirmada nesta sessão. */
  dispositivoNovo: boolean
  itens: ItemRodadaEquipe[]
}

export type MesaEquipe = {
  mesa: { numero: number; token: string }
  garcomNome: string | null
  rodadas: RodadaEquipe[]
  totalConfirmadoCentavos: number
}

// Produção (cozinha, bar)
export type StatusItem = 'NA_FILA' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE'
export type StatusProducao = Exclude<StatusItem, 'ENTREGUE'>

export type ItemProducao = {
  id: string
  nome: string
  resumoOpcoes: string
  observacao: string
  quantidade: number
  status: StatusItem
}

export type PedidoProducao = {
  rodadaId: string
  mesa: { numero: number }
  garcomNome: string | null
  confirmadaEm: string | null
  cancelada: boolean
  itens: ItemProducao[]
}

export type FilaProducao = { estacoes: string[]; pedidos: PedidoProducao[] }
