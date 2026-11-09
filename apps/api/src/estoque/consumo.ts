// Quanto uma rodada gasta de cada item de estoque, pela receita.
// Regras [spec 4A §3.2]:
// - multiplicador (opção de escolha única, ex.: G = 150%) vale para a base
//   do prato e para os sabores;
// - cada sabor entra dividido pelo número de sabores escolhidos;
// - as demais opções com receita (adicionais) somam sem multiplicar;
// - arredonda só no fim, por item.

export type LinhaReceita = { itemId: string; quantidade: number };

export type ItemVendido = {
  pratoId: string;
  selecao: Record<string, string[]>;
  quantidade: number;
};

export type OpcaoReceita = {
  multiplicadorPct: number;
  grupoId: string;
  tipoGrupo: 'UNICA' | 'MULTIPLA' | 'SABORES';
};

export type Receitas = {
  /** Receita base por prato. */
  prato: Map<string, LinhaReceita[]>;
  /** Dados de cada opção que existe (as ausentes são ignoradas). */
  opcao: Map<string, OpcaoReceita>;
  /** Receita própria de cada opção. */
  linhasOpcao: Map<string, LinhaReceita[]>;
};

export function consumoDaRodada(
  itens: ItemVendido[],
  receitas: Receitas,
): Map<string, number> {
  const total = new Map<string, number>();
  const somar = (linhas: LinhaReceita[] | undefined, fator: number) => {
    for (const l of linhas ?? []) {
      total.set(l.itemId, (total.get(l.itemId) ?? 0) + l.quantidade * fator);
    }
  };

  for (const item of itens) {
    const escolhidas = Object.values(item.selecao)
      .flat()
      .filter((id) => receitas.opcao.has(id));
    const dados = (id: string) => receitas.opcao.get(id)!;

    const mult = escolhidas
      .filter((id) => dados(id).tipoGrupo === 'UNICA')
      .reduce((m, id) => m * (dados(id).multiplicadorPct / 100), 1);
    const sabores = escolhidas.filter((id) => dados(id).tipoGrupo === 'SABORES');
    const outras = escolhidas.filter((id) => dados(id).tipoGrupo !== 'SABORES');

    somar(receitas.prato.get(item.pratoId), mult * item.quantidade);
    for (const sabor of sabores) {
      somar(
        receitas.linhasOpcao.get(sabor),
        (mult / sabores.length) * item.quantidade,
      );
    }
    for (const op of outras) {
      somar(receitas.linhasOpcao.get(op), item.quantidade);
    }
  }

  const final = new Map<string, number>();
  for (const [itemId, q] of total) {
    const arredondado = Math.round(q);
    if (arredondado !== 0) final.set(itemId, arredondado);
  }
  return final;
}
