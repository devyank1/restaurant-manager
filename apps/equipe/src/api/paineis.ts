// Chamadas da etapa 4B: tempos de preparo, metas e painéis.
import { chamar, enc, json } from './equipe'
import type {
  CentralResposta,
  DetalheGarcom,
  LimitesAlerta,
  TipoAlerta,
  MetaPessoa,
  MetasConfig,
  MetaValor,
  PainelEquipe,
  PainelEstacao,
  PainelGarcom,
  PeriodoMeta,
  TemposCardapio,
  TipoPessoa,
} from './tipos'

const E = '/api/equipe'

// Tempo de preparo
export const buscarTempos = () => chamar<TemposCardapio>(`${E}/tempos`)
export const mudarTempoCategoria = (id: string, tempoPreparoMin: number | null) =>
  chamar<object>(`${E}/tempos/categorias/${enc(id)}`, json('PATCH', { tempoPreparoMin }))
export const mudarTempoPrato = (id: string, tempoPreparoMin: number | null) =>
  chamar<object>(`${E}/tempos/pratos/${enc(id)}`, json('PATCH', { tempoPreparoMin }))

// Metas (gerente)
export const buscarMetas = () => chamar<MetasConfig>(`${E}/metas`)
export const salvarMetaEquipe = (tipo: TipoPessoa, v: MetaValor) =>
  v ? chamar<object>(`${E}/metas/equipe/${tipo}`, json('PUT', v)) : chamar<null>(`${E}/metas/equipe/${tipo}`, json('DELETE'))
export const salvarMetaPadrao = (tipo: TipoPessoa, v: MetaValor) =>
  v ? chamar<object>(`${E}/metas/garcom/${tipo}`, json('PUT', v)) : chamar<null>(`${E}/metas/garcom/${tipo}`, json('DELETE'))
export const buscarMetaPessoa = (id: string) => chamar<MetaPessoa>(`${E}/metas/garcom/pessoa/${enc(id)}`)
export const salvarAjuste = (id: string, tipo: TipoPessoa, alvo: number | null) =>
  alvo === null
    ? chamar<null>(`${E}/metas/garcom/pessoa/${enc(id)}/${tipo}`, json('DELETE'))
    : chamar<object>(`${E}/metas/garcom/pessoa/${enc(id)}/${tipo}`, json('PUT', { alvo }))
export const salvarMetaEstacao = (estacao: string, v: { noTempoPct: number | null; zeroEsquecidos: boolean }) =>
  chamar<object>(`${E}/metas/estacao/${enc(estacao)}`, json('PUT', v))
export const salvarHorasSemPausa = (horasSemPausa: number) =>
  chamar<object>(`${E}/configuracoes/painel`, json('PATCH', { horasSemPausa }))

// Painéis
export const buscarPainel = (periodo: PeriodoMeta) => chamar<PainelEquipe>(`${E}/painel?periodo=${periodo}`)
export const buscarMeuPainel = () => chamar<PainelGarcom>(`${E}/painel/eu`)
export const buscarPainelEstacao = (estacao: string) => chamar<PainelEstacao>(`${E}/painel/estacao/${enc(estacao)}`)

// Central de alertas (gerente)
export const buscarCentral = () => chamar<CentralResposta>(`${E}/painel/central`)
export const buscarDetalheGarcom = (id: string) => chamar<DetalheGarcom>(`${E}/painel/central/garcom/${enc(id)}`)
export const buscarLimites = () => chamar<LimitesAlerta>(`${E}/painel/central/limites`)
export const salvarLimite = (tipo: TipoAlerta, v: { ativo: boolean; valor: number | null }) =>
  chamar<object>(`${E}/painel/central/limites/${tipo}`, json('PUT', v))
