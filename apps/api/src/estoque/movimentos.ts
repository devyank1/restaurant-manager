// Toda mudança de quantidade do estoque passa por aqui, dentro da transação
// de quem chama: grava o movimento, soma com `increment` (atômico) e decide os
// avisos de cruzamento (uma vez por cruzamento do mínimo / do zero).
import { randomUUID } from 'node:crypto';
import type {
  MotivoPerda,
  NivelEstoque,
  Prisma,
  TipoMovimento,
  UnidadeEstoque,
} from '@prisma/client';

type Tx = Prisma.TransactionClient;

export type NovoMovimento = {
  itemId: string;
  tipo: TipoMovimento;
  /** Com sinal: venda/perda negativas. */
  quantidade: number;
  motivo?: MotivoPerda;
  observacao?: string;
  rodadaId?: string;
};

export type AvisoEstoque =
  | { tipo: 'ACABANDO' | 'ZERADO'; itemId: string; nome: string }
  | {
      tipo: 'PERDA';
      itemId: string;
      nome: string;
      quantidade: number;
      unidade: UnidadeEstoque;
      motivo: MotivoPerda;
    };

const GRAVIDADE: Record<NivelEstoque, number> = {
  OK: 0,
  ACABANDO: 1,
  ZERADO: 2,
};

export function nivelDe(quantidade: number, minimo: number): NivelEstoque {
  if (quantidade <= 0) return 'ZERADO';
  if (quantidade <= minimo) return 'ACABANDO';
  return 'OK';
}

/**
 * Soma `delta` no item e atualiza o nível. Devolve o aviso se o nível piorou.
 * O UPDATE trava a linha até o commit, então o nível lido é o da última
 * transação que mexeu no item.
 */
export async function ajustarItem(
  tx: Tx,
  itemId: string,
  delta: number,
): Promise<AvisoEstoque | null> {
  const item = await tx.itemEstoque.update({
    where: { id: itemId },
    data: { quantidade: { increment: delta } },
  });
  return recalcularNivel(tx, item);
}

/** Atualiza o nível do item (ex.: mínimo mudou) e avisa se piorou. */
export async function recalcularNivel(
  tx: Tx,
  item: {
    id: string;
    nome: string;
    quantidade: number;
    minimo: number;
    nivel: NivelEstoque;
  },
): Promise<AvisoEstoque | null> {
  const novo = nivelDe(item.quantidade, item.minimo);
  if (novo === item.nivel) return null;
  await tx.itemEstoque.update({
    where: { id: item.id },
    data: { nivel: novo },
  });
  if (GRAVIDADE[novo] <= GRAVIDADE[item.nivel]) return null;
  return {
    tipo: novo === 'ZERADO' ? 'ZERADO' : 'ACABANDO',
    itemId: item.id,
    nome: item.nome,
  };
}

/** Grava os movimentos (um lote) e devolve os avisos de cruzamento e perda. */
export async function aplicarMovimentos(
  tx: Tx,
  restauranteId: string,
  usuarioId: string | null,
  movimentos: NovoMovimento[],
  lote: string = randomUUID(),
): Promise<AvisoEstoque[]> {
  const avisos: AvisoEstoque[] = [];
  // Sempre na mesma ordem (por id): duas transações que mexem nos mesmos
  // itens travam as linhas na mesma sequência e não entram em deadlock.
  const ordenados = [...movimentos].sort((a, b) =>
    a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0,
  );
  for (const m of ordenados) {
    if (m.quantidade === 0) continue;
    await tx.movimentoEstoque.create({
      data: {
        restauranteId,
        itemId: m.itemId,
        tipo: m.tipo,
        quantidade: m.quantidade,
        motivo: m.motivo ?? null,
        observacao: m.observacao ?? null,
        rodadaId: m.rodadaId ?? null,
        usuarioId,
        lote,
      },
    });
    const aviso = await ajustarItem(tx, m.itemId, m.quantidade);
    if (aviso) avisos.push(aviso);
    if (m.tipo === 'PERDA' && m.motivo) {
      const item = await tx.itemEstoque.findUniqueOrThrow({
        where: { id: m.itemId },
      });
      avisos.push({
        tipo: 'PERDA',
        itemId: item.id,
        nome: item.nome,
        quantidade: -m.quantidade,
        unidade: item.unidade,
        motivo: m.motivo,
      });
    }
  }
  return avisos;
}
