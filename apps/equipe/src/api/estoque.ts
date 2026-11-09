// Chamadas do estoque (etapa 4A). Quantidades sempre na unidade base.
import { chamar, enc, json } from './equipe'
import type {
  Desfazivel,
  Fornecedor,
  GrupoCompra,
  ItemEstoque,
  ListaCompra,
  MotivoPerda,
  MovimentoEstoque,
  PratoReceita,
  ResumoEstoque,
  Unidade,
} from './tipos'

const E = '/api/equipe/estoque'

export type DadosItem = {
  nome: string
  unidade: Unidade
  minimo: number
  cheio: number
  fornecedorId?: string | null
  embalagemNome?: string | null
  embalagemQuantidade?: number | null
  quantidade?: number
}
export type DadosFornecedor = { nome: string; telefone?: string | null; observacao?: string | null }
export type Linha = { itemId: string; quantidade: number }

// Início e itens
export const buscarResumo = () => chamar<ResumoEstoque>(E)
export const buscarItens = (ordem?: 'perdas') => chamar<ItemEstoque[]>(`${E}/itens${ordem ? `?ordem=${ordem}` : ''}`)
export const criarItem = (dados: DadosItem) => chamar<ItemEstoque>(`${E}/itens`, json('POST', dados))
export const editarItem = (id: string, dados: Partial<DadosItem>) =>
  chamar<ItemEstoque>(`${E}/itens/${enc(id)}`, json('PATCH', dados))
export const arquivarItem = (id: string) => chamar<null>(`${E}/itens/${enc(id)}`, json('DELETE'))
export const buscarMovimentos = (id: string) => chamar<MovimentoEstoque[]>(`${E}/itens/${enc(id)}/movimentos`)
export const contarItem = (id: string, quantidade: number) =>
  chamar<ItemEstoque>(`${E}/itens/${enc(id)}/contagem`, json('POST', { quantidade }))
export const lancarEntrada = (itens: Linha[]) => chamar<ItemEstoque[]>(`${E}/entradas`, json('POST', { itens }))
export const avisarPerda = (perda: { itemId: string; quantidade: number; motivo: MotivoPerda; observacao?: string }) =>
  chamar<ItemEstoque>(`${E}/perdas`, json('POST', perda))
export const buscarDesfazivel = async () =>
  (await chamar<{ desfazivel: Desfazivel | null }>(`${E}/desfazer`)).desfazivel
export const desfazer = () => chamar<object>(`${E}/desfazer`, json('POST'))

// Fornecedores
export const buscarFornecedores = () => chamar<Fornecedor[]>(`${E}/fornecedores`)
export const criarFornecedor = (dados: DadosFornecedor) => chamar<Fornecedor>(`${E}/fornecedores`, json('POST', dados))
export const editarFornecedor = (id: string, dados: Partial<DadosFornecedor>) =>
  chamar<Fornecedor>(`${E}/fornecedores/${enc(id)}`, json('PATCH', dados))
export const excluirFornecedor = (id: string) => chamar<null>(`${E}/fornecedores/${enc(id)}`, json('DELETE'))

// Receitas e esgotado
export const buscarReceitas = () => chamar<PratoReceita[]>(`${E}/receitas`)
export const salvarReceitaPrato = (pratoId: string, itens: Linha[]) =>
  chamar<object>(`${E}/receitas/pratos/${enc(pratoId)}`, json('PUT', { itens }))
export const salvarReceitaOpcao = (opcaoId: string, itens: Linha[], multiplicadorPct?: number) =>
  chamar<object>(`${E}/receitas/opcoes/${enc(opcaoId)}`, json('PUT', { itens, multiplicadorPct }))
export const marcarEsgotado = (pratoId: string, esgotado: boolean) =>
  chamar<{ id: string; esgotado: boolean }>(`/api/equipe/pratos/${enc(pratoId)}`, json('PATCH', { esgotado }))

// Compras
export const buscarSugestao = () => chamar<GrupoCompra[]>(`${E}/compras/sugestao`)
export const salvarLista = (itens: Linha[]) => chamar<ListaCompra>(`${E}/compras`, json('POST', { itens }))
export const buscarLista = (id: string) => chamar<ListaCompra>(`${E}/compras/${enc(id)}`)
export const urlPlanilha = (id: string) => `${E}/compras/${enc(id)}/planilha`
export const compraChegou = (id: string, itens: Linha[]) =>
  chamar<object>(`${E}/compras/${enc(id)}/chegou`, json('POST', { itens }))
