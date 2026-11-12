import { useEffect, useState } from 'react'
import { buscarReceitas, marcarEsgotado } from '../api/estoque'
import type { PratoReceita } from '../api/tipos'
import { navegar } from '../rotas'
import { BarraTitulo } from './comum'
import { mensagemDe } from './textos'

function resumoReceita(p: PratoReceita): string {
  const n = p.receita.length
  if (n === 0) return 'Sem receita'
  return `Receita: ${n} ${n === 1 ? 'item' : 'itens'}`
}

/** Pratos por categoria: abrir a receita e ligar/desligar "esgotado". */
export default function TelaReceitas() {
  const [pratos, setPratos] = useState<PratoReceita[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    buscarReceitas()
      .then(setPratos)
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [])

  const alternar = async (p: PratoReceita) => {
    setErro('')
    try {
      const { esgotado } = await marcarEsgotado(p.id, !p.esgotado)
      setPratos((lista) => lista && lista.map((x) => (x.id === p.id ? { ...x, esgotado } : x)))
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  const categorias = [...new Set((pratos ?? []).map((p) => p.categoria))]

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Receitas" />
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {pratos === null && !erro && <p className="carregando">Carregando…</p>}
      {categorias.map((c) => (
        <section key={c} className="bloco-estoque" aria-label={c}>
          <h3>{c}</h3>
          <ul>
            {pratos!
              .filter((p) => p.categoria === c)
              .map((p) => (
                <li key={p.id} className="linha-receitas">
                  <button
                    type="button"
                    className="linha-estoque linha-estoque--botao"
                    onClick={() => navegar(`/estoque/receitas/${encodeURIComponent(p.id)}`)}
                  >
                    <strong>{p.nome}</strong>
                    <span className="linha-estoque-sub">{resumoReceita(p)}</span>
                  </button>
                  <button
                    type="button"
                    className={`chip${p.esgotado ? ' chip--esgotado' : ''}`}
                    aria-pressed={p.esgotado}
                    aria-label={`${p.nome} esgotado`}
                    onClick={() => alternar(p)}
                  >
                    {p.esgotado ? 'Esgotado' : 'Disponível'}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
