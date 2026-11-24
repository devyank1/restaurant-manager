// Baixa do estoque pela venda e estorno no cancelamento. Rodam dentro da
// transação que muda o status da rodada (com a mesa travada), então a baixa
// nunca diverge do pedido.
import type { Prisma } from '@prisma/client';
import { consumoDaRodada, type LinhaReceita, type Receitas } from './consumo';
import { aplicarMovimentos, type AvisoEstoque } from './movimentos';

type Tx = Prisma.TransactionClient;

export async function baixarRodada(
  tx: Tx,
  restauranteId: string,
  rodadaId: string,
  usuarioId: string | null,
): Promise<AvisoEstoque[]> {
  const itens = await tx.itemRodada.findMany({ where: { rodadaId } });
  if (itens.length === 0) return [];
  const pratoIds = [...new Set(itens.map((i) => i.pratoId))];
  const selecoes = itens.map((i) => i.selecao as Record<string, string[]>);
  const opcaoIds = [
    ...new Set(selecoes.flatMap((s) => Object.values(s).flat())),
  ];

  const linhas = await tx.receitaItem.findMany({
    where: {
      restauranteId,
      item: { ativo: true },
      OR: [{ pratoId: { in: pratoIds } }, { opcaoId: { in: opcaoIds } }],
    },
  });
  const opcoes = await tx.opcao.findMany({
    where: { id: { in: opcaoIds }, restauranteId },
    include: { grupo: true },
  });

  const agrupar = (chave: (l: (typeof linhas)[number]) => string | null) => {
    const mapa = new Map<string, LinhaReceita[]>();
    for (const l of linhas) {
      const k = chave(l);
      if (!k) continue;
      mapa.set(k, [
        ...(mapa.get(k) ?? []),
        { itemId: l.itemId, quantidade: l.quantidade },
      ]);
    }
    return mapa;
  };
  const receitas: Receitas = {
    prato: agrupar((l) => l.pratoId),
    linhasOpcao: agrupar((l) => l.opcaoId),
    opcao: new Map(
      opcoes.map((o) => [
        o.id,
        {
          multiplicadorPct: o.multiplicadorPct,
          grupoId: o.grupoId,
          tipoGrupo: o.grupo.tipo,
        },
      ]),
    ),
  };

  const consumo = consumoDaRodada(
    itens.map((i, n) => ({
      pratoId: i.pratoId,
      selecao: selecoes[n],
      quantidade: i.quantidade,
    })),
    receitas,
  );
  return aplicarMovimentos(
    tx,
    restauranteId,
    usuarioId,
    [...consumo].map(([itemId, quantidade]) => ({
      itemId,
      tipo: 'VENDA' as const,
      quantidade: -quantidade,
      rodadaId,
    })),
  );
}

/** Devolve exatamente o que a venda baixou (não relê a receita atual). */
export async function estornarRodada(
  tx: Tx,
  restauranteId: string,
  rodadaId: string,
  usuarioId: string,
): Promise<AvisoEstoque[]> {
  const vendas = await tx.movimentoEstoque.groupBy({
    by: ['itemId'],
    where: { rodadaId, tipo: 'VENDA' },
    _sum: { quantidade: true },
  });
  return aplicarMovimentos(
    tx,
    restauranteId,
    usuarioId,
    vendas.map((v) => ({
      itemId: v.itemId,
      tipo: 'ESTORNO' as const,
      quantidade: -(v._sum.quantidade ?? 0),
      rodadaId,
    })),
  );
}
