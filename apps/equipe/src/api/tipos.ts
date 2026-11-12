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
  /** Itens prontos esperando o garçom entregar. */
  prontos: number
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
  status: StatusItem
  estacao: string
}

export type FaseRodada = 'AGUARDANDO_GARCOM' | 'NA_COZINHA' | 'PRONTO' | 'ENTREGUE' | 'CANCELADA'

export type RodadaEquipe = {
  id: string
  status: StatusRodada
  fase: FaseRodada
  /** Foi direto para a produção: o garçom cancela até esta hora (ISO). */
  cancelavelAte: string | null
  criadoEm: string
  totalCentavos: number
  /** Celular que ainda não teve rodada confirmada nesta sessão. */
  dispositivoNovo: boolean
  itens: ItemRodadaEquipe[]
}

/** Opções da conta que o restaurante liga (e se vêm marcadas). */
export type ConfigConta = {
  servico: { habilitado: boolean; padrao: boolean }
  couvert: { habilitado: boolean; padrao: boolean; valorCentavos: number }
}

export type FormaPagamento = 'CARTAO' | 'PIX' | 'DINHEIRO'

export type MesaEquipe = {
  mesa: { numero: number; token: string }
  /** Há sessão aberta (dá para fechar a conta). */
  aberta: boolean
  conta: ConfigConta
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
  /** Maior tempo esperado (min) dos itens desta estação. */
  esperadoMin: number
  cancelada: boolean
  itens: ItemProducao[]
}

export type FilaProducao = { estacoes: string[]; pedidos: PedidoProducao[] }

// ---------- Estoque (etapa 4A) ----------

export type Unidade = 'UN' | 'G' | 'ML'
export type NivelEstoque = 'OK' | 'ACABANDO' | 'ZERADO'
export type MotivoPerda = 'ACIDENTE' | 'VALIDADE' | 'PREPARO' | 'OUTRO'
export type TipoMovimento = 'VENDA' | 'ESTORNO' | 'ENTRADA' | 'CONTAGEM' | 'PERDA'
export type Embalagem = { nome: string; quantidade: number }

export type ItemEstoque = {
  id: string
  nome: string
  unidade: Unidade
  /** Na unidade base (un, g, ml). */
  quantidade: number
  minimo: number
  cheio: number
  nivel: NivelEstoque
  fornecedor: { id: string; nome: string } | null
  embalagem: Embalagem | null
}

export type PratoQueUsa = { id: string; nome: string; esgotado: boolean }

export type PerdaHoje = {
  itemId: string
  nome: string
  quantidade: number
  unidade: Unidade
  motivo: MotivoPerda | null
  observacao: string | null
  criadoEm: string
}

export type ResumoEstoque = {
  acabando: ItemEstoque[]
  acabou: (ItemEstoque & { pratos: PratoQueUsa[] })[]
  perdasHoje: PerdaHoje[]
  listasAbertas: { id: string; criadaEm: string; fornecedores: string[] }[]
}

export type Fornecedor = { id: string; nome: string; telefone: string | null; observacao: string | null }

export type MovimentoEstoque = {
  id: string
  tipo: TipoMovimento
  quantidade: number
  motivo: MotivoPerda | null
  observacao: string | null
  usuario: string | null
  criadoEm: string
  desfeito: boolean
}

export type Desfazivel = { lote: string; descricao: string; ate: string }

export type LinhaReceita = { itemId: string; nome: string; unidade: Unidade; quantidade: number }

export type PratoReceita = {
  id: string
  nome: string
  categoria: string
  esgotado: boolean
  receita: LinhaReceita[]
  grupos: {
    id: string
    nome: string
    tipo: 'UNICA' | 'MULTIPLA' | 'SABORES'
    opcoes: { id: string; nome: string; multiplicadorPct: number; receita: LinhaReceita[] }[]
  }[]
}

export type LinhaCompra = {
  itemId: string
  nome: string
  unidade: Unidade
  quantidade: number
  texto: string
  embalagem: Embalagem | null
}

export type GrupoCompra = {
  fornecedor: { id: string; nome: string; telefone: string | null } | null
  itens: LinhaCompra[]
}

export type ListaCompra = {
  id: string
  /** Nome do restaurante (texto do pedido no WhatsApp). */
  restaurante: string
  criadaEm: string; chegouEm: string | null; grupos: GrupoCompra[] }

// ---------- Etapa 4B: painéis, metas e tempos ----------

export type TemposCardapio = {
  categorias: {
    id: string
    nome: string
    estacao: string
    tempoPreparoMin: number | null
    pratos: { id: string; nome: string; tempoPreparoMin: number | null }[]
  }[]
}

export type TipoMeta = 'VALOR' | 'MESAS' | 'NO_TEMPO' | 'ESQUECIDOS'
export type PeriodoMeta = 'DIA' | 'SEMANA'
export type TipoPessoa = 'VALOR' | 'MESAS'
export type MetaValor = { periodo: PeriodoMeta; alvo: number } | null

export type MetasConfig = {
  equipe: Record<TipoPessoa, MetaValor>
  garcomPadrao: Record<TipoPessoa, MetaValor>
  estacoes: { estacao: string; noTempoPct: number | null; zeroEsquecidos: boolean }[]
  garcons: { id: string; nome: string }[]
  horasSemPausa: number
}

export type MetaPessoa = { id: string; nome: string } & Record<TipoPessoa, { padrao: MetaValor; ajuste: number | null }>
