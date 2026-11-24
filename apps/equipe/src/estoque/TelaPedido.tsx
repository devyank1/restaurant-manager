import { useEffect, useState } from 'react'
import { buscarFornecedores, buscarItens, buscarSugestao, salvarLista, urlPlanilha } from '../api/estoque'
import type { ItemEstoque, ListaCompra } from '../api/tipos'
import { campoVazio } from './campo'
import { BarraTitulo } from './comum'
import { lerLinha, linhaEditavel, type FornecedorLinha, type LinhaEditavel } from './compra'
import LinhasCompra from './LinhasCompra'
import { mensagemDe } from './textos'
import { linkWhatsApp, textoPedido } from './whatsapp'

/** Pedido salvo: WhatsApp do fornecedor e a planilha. */
function Enviar({ lista }: { lista: ListaCompra }) {
  return (
    <section className="bloco-estoque" aria-labelledby="t-enviar">
      <h3 id="t-enviar">Pedido salvo</h3>
      <p className="linha-estoque-sub">Quando a compra chegar, toque em “Chegou compra” no Estoque.</p>
      <div className="estoque-acoes">
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
        <a className="botao botao--secundario" href={urlPlanilha(lista.id)} download>
          Baixar planilha
        </a>
      </div>
    </section>
  )
}

/** Lista de compras, passo 2: os itens de um fornecedor ("sem" = sem fornecedor). */
export default function TelaPedido({ fornecedorId }: { fornecedorId: string }) {
  const sem = fornecedorId === 'sem'
  const [fornecedor, setFornecedor] = useState<FornecedorLinha | undefined>(undefined)
  const [linhas, setLinhas] = useState<LinhaEditavel[] | null>(null)
  const [itens, setItens] = useState<ItemEstoque[]>([])
  const [salva, setSalva] = useState<ListaCompra | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([buscarFornecedores(), buscarSugestao(), buscarItens()])
      .then(([fornecedores, sugestao, todos]) => {
        const f = fornecedores.find((x) => x.id === fornecedorId)
        const dele: FornecedorLinha = f ? { id: f.id, nome: f.nome, telefone: f.telefone } : null
        if (!sem && !f) return setErro('Fornecedor não encontrado')
        setFornecedor(dele)
        const grupo = sugestao.find((g) => (g.fornecedor?.id ?? null) === (f?.id ?? null))
        setLinhas((grupo?.itens ?? []).map((l) => linhaEditavel(l, dele)))
        setItens(todos.filter((i) => (i.fornecedor?.id ?? null) === (f?.id ?? null)))
      })
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [fornecedorId, sem])

  const mudar = (itemId: string, mudanca: Partial<LinhaEditavel>) =>
    setLinhas((ls) => ls && ls.map((l) => (l.itemId === itemId ? { ...l, ...mudanca } : l)))

  const adicionar = (itemId: string) => {
    const item = itens.find((i) => i.id === itemId)
    if (!item || fornecedor === undefined) return
    setLinhas((ls) => [
      ...(ls ?? []),
      {
        itemId: item.id,
        nome: item.nome,
        unidade: item.unidade,
        embalagem: item.embalagem,
        fornecedor,
        embalagens: '',
        valor: campoVazio(item.unidade),
        modo: item.embalagem ? 'embalagem' : 'base',
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
  const nome = sem ? 'Sem fornecedor' : (fornecedor?.nome ?? '')

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo={nome ? `Pedido · ${nome}` : 'Pedido'} />
      {linhas === null && !erro && <p className="carregando">Carregando…</p>}
      {salva ? (
        <Enviar lista={salva} />
      ) : (
        linhas && (
          <>
            {linhas.length === 0 && <p className="vazio">Nada acabando deste fornecedor. Adicione o que quer pedir.</p>}
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
            <div className="estoque-acoes">
              <button type="button" className="botao botao--primario" disabled={salvando || linhas.length === 0} onClick={salvar}>
                Salvar pedido
              </button>
            </div>
          </>
        )
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </main>
  )
}
