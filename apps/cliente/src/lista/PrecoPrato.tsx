import type { PratoPublico } from '../api/tipos'
import { formatarReais, precoExibicao } from '../preco/preco'

export default function PrecoPrato({ prato, grande = false }: { prato: PratoPublico; grande?: boolean }) {
  const preco = precoExibicao(prato)
  const tamanho = grande ? ' preco--grande' : ''

  if (preco.aPartirDe) {
    return <span className={`preco preco--cheio${tamanho}`}>{`a partir de ${formatarReais(preco.centavos)}`}</span>
  }

  const cheio = preco.desconto === null ? ' preco--cheio' : ''
  return (
    <span className="preco-linha">
      <span className={`preco${cheio}${tamanho}`}>{formatarReais(preco.centavos)}</span>
      {preco.originalCentavos !== null && <s className="preco-original">{formatarReais(preco.originalCentavos)}</s>}
      {preco.desconto !== null && <span className="preco-desconto">{`-${preco.desconto}%`}</span>}
    </span>
  )
}
