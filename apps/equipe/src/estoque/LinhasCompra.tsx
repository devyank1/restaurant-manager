import { useId } from 'react'
import CampoQuantidade from './CampoQuantidade'
import { plural, porFornecedor, type LinhaEditavel } from './compra'
import { formatarQuantidade } from './unidades'

/** Grupos por fornecedor com as quantidades editáveis (lista e chegada). */
export default function LinhasCompra({
  linhas,
  onMudar,
  onTirar,
}: {
  linhas: LinhaEditavel[]
  onMudar: (itemId: string, mudanca: Partial<LinhaEditavel>) => void
  onTirar?: (itemId: string) => void
}) {
  const id = useId()
  return (
    <>
      {porFornecedor(linhas).map((g, n) => {
        const nome = g.fornecedor?.nome ?? 'Sem fornecedor'
        return (
          <section key={g.fornecedor?.id ?? ''} className="bloco-estoque" aria-labelledby={`${id}-${n}`}>
            <h3 id={`${id}-${n}`}>{nome}</h3>
            <ul>
              {g.linhas.map((l) => (
                <li key={l.itemId} className="linha-receita">
                  {l.embalagem ? (
                    <label className="campo-quantidade">
                      {`${plural(l.embalagem.nome)} de ${l.nome}`}
                      <span className="linha-estoque-sub">{`1 ${l.embalagem.nome} = ${formatarQuantidade(l.embalagem.quantidade, l.unidade)}`}</span>
                      <input
                        aria-label={`${plural(l.embalagem.nome)} de ${l.nome}`}
                        inputMode="numeric"
                        value={l.embalagens}
                        onChange={(e) => onMudar(l.itemId, { embalagens: e.target.value })}
                      />
                    </label>
                  ) : (
                    <CampoQuantidade
                      rotulo={`Quantidade de ${l.nome}`}
                      rotuloUnidade={`Unidade de ${l.nome}`}
                      unidade={l.unidade}
                      valor={l.valor}
                      onMudar={(valor) => onMudar(l.itemId, { valor })}
                    />
                  )}
                  {onTirar && (
                    <button
                      type="button"
                      className="botao botao--secundario"
                      aria-label={`Tirar ${l.nome} da lista`}
                      onClick={() => onTirar(l.itemId)}
                    >
                      Tirar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
