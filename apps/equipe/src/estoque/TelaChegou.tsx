import { useEffect, useState } from 'react'
import { buscarLista, compraChegou } from '../api/estoque'
import { navegar } from '../rotas'
import { BarraTitulo } from './comum'
import { lerLinha, linhaEditavel, type LinhaEditavel } from './compra'
import LinhasCompra from './LinhasCompra'
import { mensagemDe } from './textos'

/** Compra chegou: confere as quantidades da lista e lança a entrada. */
export default function TelaChegou({ listaId }: { listaId: string }) {
  const [linhas, setLinhas] = useState<LinhaEditavel[] | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscarLista(listaId)
      .then((lista) => setLinhas(lista.grupos.flatMap((g) => g.itens.map((l) => linhaEditavel(l, g.fornecedor)))))
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [listaId])

  const confirmar = async () => {
    if (!linhas) return
    const lidas = linhas.map((l) => ({ itemId: l.itemId, quantidade: lerLinha(l, true) }))
    if (lidas.some((l) => l.quantidade === null)) return setErro('Digite quantidades válidas (0 se não veio)')
    setErro('')
    setSalvando(true)
    try {
      await compraChegou(listaId, lidas as { itemId: string; quantidade: number }[])
      navegar('/estoque')
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Chegou compra" volta="/estoque" rotuloVolta="Estoque" />
      <p className="linha-estoque-sub">Confira o que chegou. Se algo não veio, deixe 0.</p>
      {linhas === null && !erro && <p className="carregando">Carregando…</p>}
      {linhas && (
        <LinhasCompra
          linhas={linhas}
          onMudar={(itemId, mudanca) => setLinhas((ls) => ls && ls.map((l) => (l.itemId === itemId ? { ...l, ...mudanca } : l)))}
        />
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {linhas && (
        <div className="estoque-acoes">
          <button type="button" className="botao botao--sucesso" disabled={salvando} onClick={confirmar}>
            Confirmar chegada
          </button>
        </div>
      )}
    </main>
  )
}
