import type { Rota } from '../rotas'
import TelaEstoque from './TelaEstoque'
import TelaFornecedores from './TelaFornecedores'
import TelaItem from './TelaItem'
import TelaItens from './TelaItens'
import TelaReceita from './TelaReceita'
import TelaReceitas from './TelaReceitas'
import '../estilo/estoque.css'

/** Telas do estoque (só o gerente; o App já conferiu o papel). */
export default function TelaEstoqueRotas({ rota }: { rota: Rota }) {
  switch (rota.nome) {
    case 'estoque-itens':
      return <TelaItens />
    case 'estoque-item':
      return <TelaItem key={rota.id} id={rota.id} />
    case 'estoque-receitas':
      return <TelaReceitas />
    case 'estoque-receita':
      return <TelaReceita key={rota.pratoId} pratoId={rota.pratoId} />
    case 'estoque-fornecedores':
      return <TelaFornecedores />
    default:
      return <TelaEstoque />
  }
}
