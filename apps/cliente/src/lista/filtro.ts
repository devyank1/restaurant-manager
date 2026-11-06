import type { CardapioPublico, PratoPublico } from '../api/tipos'

export const DESTAQUES = 'destaques'

export function pratosDoFiltro(cardapio: CardapioPublico, filtro: string): PratoPublico[] {
  if (filtro === DESTAQUES) {
    return cardapio.categorias.flatMap((c) => c.pratos).filter((p) => p.destaque)
  }
  return cardapio.categorias.find((c) => c.id === filtro)?.pratos ?? []
}
