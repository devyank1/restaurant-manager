import { formatarReais, precoExibicao, SeletorOpcoes, type PratoPublico } from '@cardapio/opcoes'
import { useState } from 'react'
import type { CardapioPublico } from '../api/cardapio'
import type { NovoItemRodada } from '../api/equipe'

/** Lista os pratos disponíveis; escolher abre o seletor (opções, observação, quantidade). */
export default function AdicionarItem({
  cardapio,
  onEscolher,
  onFechar,
}: {
  cardapio: CardapioPublico
  onEscolher: (item: NovoItemRodada) => void
  onFechar: () => void
}) {
  const [prato, setPrato] = useState<PratoPublico | null>(null)

  if (prato) {
    return (
      <SeletorOpcoes
        prato={prato}
        onCancelar={() => setPrato(null)}
        onConfirmar={({ pratoId, selecao, observacao, quantidade }) =>
          onEscolher({ pratoId, selecao, observacao, quantidade })
        }
      />
    )
  }

  const categorias = cardapio.categorias
    .map((c) => ({ ...c, pratos: c.pratos.filter((p) => !p.esgotado) }))
    .filter((c) => c.pratos.length > 0)

  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar prato"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2>Adicionar prato</h2>
        {categorias.map((c) => (
          <section key={c.id} className="adicionar-categoria">
            <h3>{c.nome}</h3>
            {c.pratos.map((p) => {
              const preco = precoExibicao(p)
              return (
                <button key={p.id} type="button" className="adicionar-prato" onClick={() => setPrato(p)}>
                  <span>{p.nome}</span>
                  <span className="adicionar-preco">
                    {`${preco.aPartirDe ? 'a partir de ' : ''}${formatarReais(preco.centavos)}`}
                  </span>
                </button>
              )
            })}
          </section>
        ))}
        <button type="button" className="botao botao--secundario" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}
