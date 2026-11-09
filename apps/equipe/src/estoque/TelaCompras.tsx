import { useEffect, useState } from 'react'
import { buscarItens, buscarSugestao, salvarLista, urlPlanilha } from '../api/estoque'
import type { ItemEstoque, ListaCompra } from '../api/tipos'
import { campoVazio } from './campo'
import { BarraTitulo } from './comum'
import { lerLinha, linhaEditavel, type LinhaEditavel } from './compra'
import LinhasCompra from './LinhasCompra'
import { mensagemDe } from './textos'
import { linkWhatsApp, textoPedido } from './whatsapp'

/** Lista salva: planilha e um WhatsApp por fornecedor. */
function Enviar({ lista }: { lista: ListaCompra }) {
  return (
    <section className="bloco-estoque" aria-labelledby="t-enviar">
      <h3 id="t-enviar">Lista salva</h3>
      <div className="estoque-acoes">
        <a className="botao botao--primario" href={urlPlanilha(lista.id)} download>
          Baixar planilha
        </a>
        {lista.grupos
          .filter((g) => g.fornecedor)
          .map((g) => (
            <a
              key={g.fornecedor!.id}
              className="botao botao--sucesso"
              href={linkWhatsApp(g.fornecedor!.telefone, textoPedido(lista.restaurante, g.fornecedor!.nome, g.itens))}
              target="_blank"
              rel="noopener noreferrer"
            >
              {`Mandar no WhatsApp para ${g.fornecedor!.nome}`}
            </a>
          ))}
      </div>
    </section>
  )
}

export default function TelaCompras() {
  const [linhas, setLinhas] = useState<LinhaEditavel[] | null>(null)
  const [itens, setItens] = useState<ItemEstoque[]>([])
  const [salva, setSalva] = useState<ListaCompra | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscarSugestao()
      .then((grupos) => setLinhas(grupos.flatMap((g) => g.itens.map((l) => linhaEditavel(l, g.fornecedor)))))
      .catch((e: unknown) => setErro(mensagemDe(e)))
    buscarItens()
      .then(setItens)
      .catch(() => undefined)
  }, [])

  const mudar = (itemId: string, mudanca: Partial<LinhaEditavel>) =>
    setLinhas((ls) => ls && ls.map((l) => (l.itemId === itemId ? { ...l, ...mudanca } : l)))

  const adicionar = (itemId: string) => {
    const item = itens.find((i) => i.id === itemId)
    if (!item) return
    setLinhas((ls) => [
      ...(ls ?? []),
      {
        itemId: item.id,
        nome: item.nome,
        unidade: item.unidade,
        embalagem: item.embalagem,
        fornecedor: item.fornecedor ? { ...item.fornecedor, telefone: null } : null,
        embalagens: '',
        valor: campoVazio(item.unidade),
      },
    ])
  }

  const salvar = async () => {
    if (!linhas?.length) return
    const lidas = linhas.map((l) => ({ itemId: l.itemId, quantidade: lerLinha(l, false) }))
    if (lidas.some((l) => l.quantidade === null)) return setErro('Digite uma quantidade maior que zero')
    setErro('')
    setSalvando(true)
    try {
      setSalva(await salvarLista(lidas as { itemId: string; quantidade: number }[]))
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setSalvando(false)
    }
  }

  const livres = itens.filter((i) => !linhas?.some((l) => l.itemId === i.id))

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Lista de compras" volta="/estoque" rotuloVolta="Estoque" />
      {linhas === null && !erro && <p className="carregando">Carregando…</p>}
      {salva ? (
        <Enviar lista={salva} />
      ) : (
        linhas && (
          <>
            {linhas.length === 0 && <p className="vazio">Nada abaixo do mínimo agora.</p>}
            <LinhasCompra linhas={linhas} onMudar={mudar} onTirar={(id) => setLinhas((ls) => ls && ls.filter((l) => l.itemId !== id))} />
            {livres.length > 0 && (
              <label className="campo-quantidade">
                Adicionar item
                <select value="" onChange={(e) => adicionar(e.target.value)}>
                  <option value="">Escolha um item…</option>
                  {livres.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {erro && (
              <p className="erro" role="alert">
                {erro}
              </p>
            )}
            <div className="estoque-acoes">
              <button type="button" className="botao botao--primario" disabled={salvando || linhas.length === 0} onClick={salvar}>
                Salvar lista
              </button>
            </div>
          </>
        )
      )}
      {!linhas && erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </main>
  )
}
