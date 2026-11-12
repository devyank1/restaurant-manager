import { useEffect, useState } from 'react'
import { buscarFornecedores, buscarSugestao } from '../api/estoque'
import type { Fornecedor, GrupoCompra } from '../api/tipos'
import { navegar } from '../rotas'
import { BarraTitulo } from './comum'
import { mensagemDe } from './textos'

type Opcao = { id: string; nome: string; aComprar: number }

/** Quem tem algo para comprar vem primeiro; depois A→Z. */
function opcoes(fornecedores: Fornecedor[], sugestao: GrupoCompra[]): Opcao[] {
  const contar = (id: string | null) => sugestao.find((g) => (g.fornecedor?.id ?? null) === id)?.itens.length ?? 0
  const lista: Opcao[] = fornecedores.map((f) => ({ id: f.id, nome: f.nome, aComprar: contar(f.id) }))
  const semFornecedor = contar(null)
  if (semFornecedor > 0) lista.push({ id: 'sem', nome: 'Sem fornecedor', aComprar: semFornecedor })
  return lista.sort((a, b) => Number(b.aComprar > 0) - Number(a.aComprar > 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Lista de compras, passo 1: escolher para quem pedir. */
export default function TelaCompras() {
  const [lista, setLista] = useState<Opcao[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([buscarFornecedores(), buscarSugestao()])
      .then(([fornecedores, sugestao]) => setLista(opcoes(fornecedores, sugestao)))
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [])

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Lista de compras" />
      <p className="linha-estoque-sub">Escolha o fornecedor. Os itens abaixo do mínimo já vêm com a quantidade para encher.</p>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {lista === null && !erro && <p className="carregando">Carregando…</p>}
      {lista && lista.length === 0 && <p className="vazio">Cadastre um fornecedor ou um item para montar a lista.</p>}
      {lista && (
        <ul className="lista-estoque">
          {lista.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className={`linha-estoque--botao${o.aComprar > 0 ? ' linha-estoque--destaque' : ''}`}
                onClick={() => navegar(`/estoque/compras/f/${encodeURIComponent(o.id)}`)}
              >
                {`${o.nome} · ${o.aComprar > 0 ? `${o.aComprar} ${o.aComprar === 1 ? 'item' : 'itens'} para comprar` : 'nada acabando'}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
