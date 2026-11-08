import { Selecao } from '../pedidos/preco';
import { faseDa } from './fase';
import { RodadaComItens, RodadaEquipe, RodadaPublica } from './rodadas.types';

export function somarConfirmadas(rodadas: RodadaComItens[]): number {
  return rodadas
    .filter((r) => r.status === 'CONFIRMADA')
    .reduce((soma, r) => soma + r.totalCentavos, 0);
}

export function paraPublica(r: RodadaComItens): RodadaPublica {
  return {
    id: r.id,
    status: r.status,
    fase: faseDa(r),
    criadoEm: r.criadoEm,
    totalCentavos: r.totalCentavos,
    itens: r.itens.map((i) => ({
      nome: i.nome,
      resumoOpcoes: i.resumoOpcoes,
      observacao: i.observacao,
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.precoUnitarioCentavos,
      status: i.status,
    })),
  };
}

/** Fim da janela de cancelamento, se a rodada foi direto e ainda está nela. */
export function cancelavelAte(
  r: { direta: boolean; status: string; confirmadaEm: Date | null },
  janelaSegundos: number,
  agora = new Date(),
): Date | null {
  if (!r.direta || r.status !== 'CONFIRMADA' || !r.confirmadaEm) return null;
  const fim = new Date(r.confirmadaEm.getTime() + janelaSegundos * 1000);
  return fim > agora ? fim : null;
}

export function paraEquipe(
  r: RodadaComItens,
  dispositivoNovo: boolean,
  janelaSegundos = 0,
): RodadaEquipe {
  return {
    ...paraPublica(r),
    dispositivoNovo,
    cancelavelAte: cancelavelAte(r, janelaSegundos)?.toISOString() ?? null,
    itens: r.itens.map((i) => ({
      id: i.id,
      pratoId: i.pratoId,
      nome: i.nome,
      resumoOpcoes: i.resumoOpcoes,
      selecao: i.selecao as Selecao,
      observacao: i.observacao,
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.precoUnitarioCentavos,
      status: i.status,
      estacao: i.estacao,
    })),
  };
}
