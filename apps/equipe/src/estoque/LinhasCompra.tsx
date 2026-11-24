import { useId } from 'react'
import CampoQuantidade from './CampoQuantidade'
import { campoDe } from './campo'
import { lerLinha, plural, porFornecedor, type LinhaEditavel } from './compra'
import { formatarQuantidade, unidadesDe } from './unidades'

/** Grupos por fornecedor com as quantidades editáveis (pedido e chegada). */
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
                <li key={l.itemId} className="linha-compra">
                  <div className="linha-estoque-topo">
                    <strong>{l.nome}</strong>
                    {onTirar && (
                      <button
                        type="button"
                        className="botao botao--secundario botao--pequeno"
                        aria-label={`Tirar ${l.nome} da lista`}
                        onClick={() => onTirar(l.itemId)}
                      >
                        Tirar
                      </button>
                    )}
                  </div>
                  <div className="linha-compra-campos">
                    {l.embalagem && (
                      <label className="campo-quantidade">
                        Medida
                        <select
                          aria-label={`Medida de ${l.nome}`}
                          value={l.modo}
                          onChange={(e) => {
                            const modo = e.target.value as LinhaEditavel['modo']
                            const atual = lerLinha(l, true)
                            onMudar(l.itemId, {
                              modo,
                              ...(modo === 'base' && atual !== null ? { valor: campoDe(atual, l.unidade) } : {}),
                            })
                          }}
                        >
                          <option value="embalagem">{plural(l.embalagem.nome)}</option>
                          <option value="base">{unidadesDe(l.unidade).join(' ou ')}</option>
                        </select>
                      </label>
                    )}
                    {l.embalagem && l.modo === 'embalagem' ? (
                      <label className="campo-quantidade">
                        Quantas
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
                  </div>
                  {l.embalagem && l.modo === 'embalagem' && (
                    <span className="linha-estoque-sub">{`1 ${l.embalagem.nome} = ${formatarQuantidade(l.embalagem.quantidade, l.unidade)}`}</span>
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
