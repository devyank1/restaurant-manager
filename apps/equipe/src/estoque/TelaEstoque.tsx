import { useEffect, useState } from 'react'
import { buscarResumo, marcarEsgotado } from '../api/estoque'
import type { ResumoEstoque } from '../api/tipos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import BarraDesfazer from './BarraDesfazer'
import { BarraTitulo, Quantidade } from './comum'
import { mensagemDe, NOME_MOTIVO } from './textos'
import { formatarQuantidade } from './unidades'

/** Início do estoque: o que está acabando, o que acabou e as perdas de hoje. */
export default function TelaEstoque() {
  const [resumo, setResumo] = useState<ResumoEstoque | null>(null)
  const [erro, setErro] = useState('')

  const recarregar = useMaisRecente(buscarResumo, setResumo)
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  useEquipeAoVivo({ estoque: recarregar })

  const esgotar = async (pratoId: string) => {
    setErro('')
    try {
      await marcarEsgotado(pratoId, true)
      setResumo((r) =>
        r && {
          ...r,
          acabou: r.acabou.map((i) => ({
            ...i,
            pratos: i.pratos.map((p) => (p.id === pratoId ? { ...p, esgotado: true } : p)),
          })),
        },
      )
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  const vazio = resumo && !resumo.acabando.length && !resumo.acabou.length && !resumo.perdasHoje.length

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Estoque" />
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {resumo === null ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <>
          <BarraDesfazer chave={resumo} onDesfez={() => void recarregar()} />
          {vazio && <p className="vazio">Tudo em dia ✓</p>}

          {resumo.acabou.length > 0 && (
            <section className="bloco-estoque bloco-estoque--perigo" aria-labelledby="t-acabou">
              <h3 id="t-acabou">Acabou</h3>
              <ul>
                {resumo.acabou.map((i) => (
                  <li key={i.id} className="linha-estoque">
                    <div className="linha-estoque-topo">
                      <strong>{i.nome}</strong>
                      <Quantidade base={i.quantidade} unidade={i.unidade} />
                    </div>
                    {i.pratos.length > 0 && (
                      <ul className="pratos-acabou">
                        {i.pratos.map((p) => (
                          <li key={p.id}>
                            <span>{p.nome}</span>
                            {p.esgotado ? (
                              <button type="button" className="botao botao--secundario" disabled aria-label={`${p.nome} esgotado`}>
                                Esgotado ✓
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="botao botao--perigo"
                                aria-label={`Marcar ${p.nome} como esgotado`}
                                onClick={() => esgotar(p.id)}
                              >
                                Marcar como esgotado
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resumo.acabando.length > 0 && (
            <section className="bloco-estoque bloco-estoque--alerta" aria-labelledby="t-acabando">
              <h3 id="t-acabando">Acabando</h3>
              <ul>
                {resumo.acabando.map((i) => (
                  <li key={i.id} className="linha-estoque">
                    <div className="linha-estoque-topo">
                      <strong>{i.nome}</strong>
                      <Quantidade base={i.quantidade} unidade={i.unidade} />
                    </div>
                    <span className="linha-estoque-sub">{`mínimo ${formatarQuantidade(i.minimo, i.unidade)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resumo.perdasHoje.length > 0 && (
            <section className="bloco-estoque" aria-labelledby="t-perdas">
              <h3 id="t-perdas">Perdas de hoje</h3>
              <ul>
                {resumo.perdasHoje.map((p, n) => (
                  <li key={`${p.itemId}-${n}`} className="linha-estoque">
                    <span>
                      {`${formatarQuantidade(p.quantidade, p.unidade)} de ${p.nome}${p.motivo ? ` · ${NOME_MOTIVO[p.motivo]}` : ''}`}
                    </span>
                    {p.observacao && <span className="linha-estoque-sub">{p.observacao}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="estoque-acoes">
            <button type="button" className="botao botao--primario" onClick={() => navegar('/estoque/compras')}>
              Gerar lista de compras
            </button>
            {resumo.listasAbertas.map((l) => (
              <button
                key={l.id}
                type="button"
                className="botao botao--sucesso"
                onClick={() => navegar(`/estoque/compras/${encodeURIComponent(l.id)}/chegou`)}
              >
                {[
                  'Chegou compra',
                  ...l.fornecedores,
                  ...(resumo.listasAbertas.length > 1
                    ? [new Date(l.criadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })]
                    : []),
                ].join(' · ')}
              </button>
            ))}
            <button type="button" className="botao botao--secundario" onClick={() => navegar('/estoque/itens')}>
              Itens
            </button>
            <button type="button" className="botao botao--secundario" onClick={() => navegar('/estoque/receitas')}>
              Receitas
            </button>
            <button type="button" className="botao botao--secundario" onClick={() => navegar('/estoque/fornecedores')}>
              Fornecedores
            </button>
          </div>
        </>
      )}
    </main>
  )
}
