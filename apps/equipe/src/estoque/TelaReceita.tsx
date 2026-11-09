import { useEffect, useId, useState } from 'react'
import { buscarItens, buscarReceitas, salvarReceitaOpcao, salvarReceitaPrato, type Linha } from '../api/estoque'
import type { ItemEstoque, LinhaReceita, PratoReceita } from '../api/tipos'
import { campoDe, campoVazio, lerCampo, type ValorCampo } from './campo'
import CampoQuantidade from './CampoQuantidade'
import { BarraTitulo } from './comum'
import { mensagemDe } from './textos'

type LinhaEditada = { itemId: string; nome: string; unidade: ItemEstoque['unidade']; valor: ValorCampo }

function editavel(l: LinhaReceita): LinhaEditada {
  return { itemId: l.itemId, nome: l.nome, unidade: l.unidade, valor: campoDe(l.quantidade, l.unidade) }
}

/** Uma receita (do prato ou de uma opção), com o próprio botão Salvar. */
function EditorReceita({
  rotulo,
  dica,
  linhasIniciais,
  itens,
  multiplicador,
  onSalvar,
}: {
  rotulo: string
  dica?: string
  linhasIniciais: LinhaReceita[]
  itens: ItemEstoque[]
  /** Só em opção de escolha única (tamanho). */
  multiplicador?: number
  onSalvar: (linhas: Linha[], multiplicadorPct?: number) => Promise<unknown>
}) {
  const id = useId()
  const [linhas, setLinhas] = useState<LinhaEditada[]>(() => linhasIniciais.map(editavel))
  const [mult, setMult] = useState(multiplicador === undefined ? '' : String(multiplicador))
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)

  const livres = itens.filter((i) => !linhas.some((l) => l.itemId === i.id))

  const adicionar = (itemId: string) => {
    const item = itens.find((i) => i.id === itemId)
    if (!item) return
    setLinhas((ls) => [...ls, { itemId: item.id, nome: item.nome, unidade: item.unidade, valor: campoVazio(item.unidade) }])
  }

  const salvar = async () => {
    setAviso('')
    const lidas = linhas.map((l) => ({ itemId: l.itemId, quantidade: lerCampo(l.valor, l.unidade) }))
    if (lidas.some((l) => l.quantidade === null)) return setErro('Digite uma quantidade maior que zero')
    let pct: number | undefined
    if (multiplicador !== undefined) {
      pct = Number(mult)
      if (!/^\d+$/.test(mult.trim()) || pct < 10 || pct > 500) return setErro('Use um número de 10 a 500')
    }
    setErro('')
    setSalvando(true)
    try {
      await onSalvar(lidas as Linha[], pct)
      setAviso('Receita salva')
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="bloco-estoque" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`}>{rotulo}</h3>
      {dica && <p className="linha-estoque-sub">{dica}</p>}
      {multiplicador !== undefined && (
        <label className="campo-quantidade">
          Multiplica a receita (%)
          <input inputMode="numeric" value={mult} onChange={(e) => setMult(e.target.value)} />
        </label>
      )}
      <ul>
        {linhas.map((l) => (
          <li key={l.itemId} className="linha-receita">
            <CampoQuantidade
              rotulo={`Quantidade de ${l.nome}`}
              rotuloUnidade={`Unidade de ${l.nome}`}
              unidade={l.unidade}
              valor={l.valor}
              onMudar={(valor) => setLinhas((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, valor } : x)))}
            />
            <button
              type="button"
              className="botao botao--secundario"
              aria-label={`Remover ${l.nome}`}
              onClick={() => setLinhas((ls) => ls.filter((x) => x.itemId !== l.itemId))}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      {livres.length > 0 && (
        <label className="campo-quantidade">
          Adicionar ingrediente
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
      {aviso && <p role="status">{aviso}</p>}
      <button type="button" className="botao botao--primario" disabled={salvando} onClick={salvar}>
        Salvar
      </button>
    </section>
  )
}

export default function TelaReceita({ pratoId }: { pratoId: string }) {
  const [prato, setPrato] = useState<PratoReceita | null | undefined>(undefined)
  const [itens, setItens] = useState<ItemEstoque[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([buscarReceitas(), buscarItens()])
      .then(([pratos, todos]) => {
        setItens(todos)
        setPrato(pratos.find((p) => p.id === pratoId) ?? null)
      })
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [pratoId])

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo={prato?.nome ?? 'Receita'} volta="/estoque/receitas" rotuloVolta="Receitas" />
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {prato === undefined && !erro && <p className="carregando">Carregando…</p>}
      {prato === null && <p className="vazio">Prato não encontrado.</p>}
      {prato && (
        <>
          <EditorReceita
            rotulo="Receita do prato"
            dica="O que vai em uma porção."
            linhasIniciais={prato.receita}
            itens={itens}
            onSalvar={(linhas) => salvarReceitaPrato(prato.id, linhas)}
          />
          {prato.grupos.map((g) => (
            <div key={g.id} className="grupo-receita">
              <h3>{g.nome}</h3>
              {g.tipo === 'SABORES' && (
                <p className="linha-estoque-sub">Cada sabor entra pela metade numa pizza meio a meio</p>
              )}
              {g.tipo === 'UNICA' && (
                <p className="linha-estoque-sub">G = 150 → usa 1,5× a receita do prato e dos sabores</p>
              )}
              {g.opcoes.map((o) => (
                <EditorReceita
                  key={o.id}
                  rotulo={`Opção ${o.nome} (${g.nome})`}
                  linhasIniciais={o.receita}
                  itens={itens}
                  multiplicador={g.tipo === 'UNICA' ? o.multiplicadorPct : undefined}
                  onSalvar={(linhas, pct) => salvarReceitaOpcao(o.id, linhas, pct)}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </main>
  )
}
