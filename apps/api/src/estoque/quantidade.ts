// Formato das quantidades do estoque ("1,5 kg", "800 g", "2 L", "30 un").
// Espelha apps/equipe/src/estoque/unidades.ts (mesmos casos de teste).

export type Unidade = 'UN' | 'G' | 'ML';
export type Embalagem = { nome: string; quantidade: number };

function numero(valor: number): string {
  return String(Math.round(valor * 1000) / 1000).replace('.', ',');
}

export function formatarQuantidade(base: number, unidade: Unidade): string {
  if (base < 0) return '0 (conferir)';
  if (unidade === 'G') {
    return base >= 1000 ? `${numero(base / 1000)} kg` : `${numero(base)} g`;
  }
  if (unidade === 'ML') {
    return base >= 1000 ? `${numero(base / 1000)} L` : `${numero(base)} ml`;
  }
  return `${numero(base)} un`;
}

/** Quantas embalagens cobrem a quantidade (arredonda para cima). */
export function embalagensPara(base: number, porEmbalagem: number): number {
  return Math.ceil(base / porEmbalagem);
}

/** "2 Cartela (60 un)" com embalagem; senão só a quantidade. */
export function formatarCompra(
  base: number,
  unidade: Unidade,
  embalagem: Embalagem | null,
): string {
  if (!embalagem) return formatarQuantidade(base, unidade);
  const n = embalagensPara(base, embalagem.quantidade);
  const total = formatarQuantidade(n * embalagem.quantidade, unidade);
  return `${n} ${embalagem.nome} (${total})`;
}
