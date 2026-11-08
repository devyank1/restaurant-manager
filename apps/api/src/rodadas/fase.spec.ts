import { StatusItem, StatusRodada } from '@prisma/client';
import { faseDa } from './fase';

const rodada = (status: StatusRodada, ...itens: StatusItem[]) => ({
  status,
  itens: itens.map((s) => ({ status: s })),
});

describe('faseDa', () => {
  it('aguardando e cancelada passam direto', () => {
    expect(faseDa(rodada('AGUARDANDO_GARCOM', 'NA_FILA'))).toBe(
      'AGUARDANDO_GARCOM',
    );
    expect(faseDa(rodada('CANCELADA', 'PRONTO'))).toBe('CANCELADA');
  });

  it('confirmada com item na fila → NA_COZINHA', () => {
    expect(faseDa(rodada('CONFIRMADA', 'PRONTO', 'NA_FILA'))).toBe(
      'NA_COZINHA',
    );
    expect(faseDa(rodada('CONFIRMADA', 'EM_PREPARO'))).toBe('NA_COZINHA');
    expect(faseDa(rodada('CONFIRMADA'))).toBe('NA_COZINHA');
  });

  it('todos PRONTO → PRONTO', () => {
    expect(faseDa(rodada('CONFIRMADA', 'PRONTO', 'PRONTO'))).toBe('PRONTO');
  });

  it('PRONTO + ENTREGUE → PRONTO', () => {
    expect(faseDa(rodada('CONFIRMADA', 'PRONTO', 'ENTREGUE'))).toBe('PRONTO');
  });

  it('todos ENTREGUE → ENTREGUE', () => {
    expect(faseDa(rodada('CONFIRMADA', 'ENTREGUE', 'ENTREGUE'))).toBe(
      'ENTREGUE',
    );
  });
});
