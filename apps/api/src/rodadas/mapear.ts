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

export function paraEquipe(
  r: RodadaComItens,
  dispositivoNovo: boolean,
): RodadaEquipe {
  return {
    ...paraPublica(r),
    dispositivoNovo,
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
