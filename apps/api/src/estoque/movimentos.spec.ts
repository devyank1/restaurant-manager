import type { Prisma } from '@prisma/client';
import { aplicarMovimentos } from './movimentos';

/** Tx falso: só registra a ordem em que os itens são travados (UPDATE). */
function txFalso() {
  const ordem: string[] = [];
  const tx = {
    movimentoEstoque: { create: () => Promise.resolve({}) },
    itemEstoque: {
      update: ({ where }: { where: { id: string } }) => {
        ordem.push(where.id);
        return Promise.resolve({
          id: where.id,
          nome: where.id,
          quantidade: 100,
          minimo: 0,
          nivel: 'OK',
        });
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, ordem };
}

describe('aplicarMovimentos', () => {
  it('trava os itens sempre em ordem de id (duas rodadas ao mesmo tempo não se travam)', async () => {
    const { tx, ordem } = txFalso();
    await aplicarMovimentos(tx, 'r', null, [
      { itemId: 'ovos', tipo: 'VENDA', quantidade: -2 },
      { itemId: 'bacon', tipo: 'VENDA', quantidade: -50 },
      { itemId: 'massa', tipo: 'VENDA', quantidade: -300 },
    ]);
    expect(ordem).toEqual(['bacon', 'massa', 'ovos']);
  });

  it('usa o lote informado', async () => {
    const lotes: string[] = [];
    const { tx } = txFalso();
    (tx.movimentoEstoque as unknown as { create: unknown }).create = ({
      data,
    }: {
      data: { lote: string };
    }) => {
      lotes.push(data.lote);
      return Promise.resolve({});
    };
    await aplicarMovimentos(
      tx,
      'r',
      null,
      [{ itemId: 'ovos', tipo: 'ENTRADA', quantidade: 30 }],
      'lote-1',
    );
    expect(lotes).toEqual(['lote-1']);
  });
});
