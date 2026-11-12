import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { arquivarItem, buscarFornecedores, buscarItens, buscarMovimentos, contarItem, editarItem } from '../api/estoque'
import type { Fornecedor, ItemEstoque, MovimentoEstoque, TipoMovimento } from '../api/tipos'
import { navegar } from '../rotas'
import { campoDe, campoVazio, lerCampo, type ValorCampo } from './campo'
import CampoQuantidade from './CampoQuantidade'
import { BarraTitulo, Confirmacao, Quantidade, SeloNivel } from './comum'
import { mensagemDe, NOME_MOTIVO } from './textos'
import { formatarQuantidade } from './unidades'

const NOME_TIPO: Record<TipoMovimento, string> = {
  VENDA: 'Venda',
  ESTORNO: 'Cancelamento',
  ENTRADA: 'Chegada',
  CONTAGEM: 'Contagem',
  PERDA: 'Perda',
}

/** Diferença grande na contagem pede confirmação: mais de 20% do nível cheio. */
const DIFERENCA_GRANDE = 0.2

function comSinal(base: number, item: ItemEstoque): string {
  return `${base < 0 ? '−' : '+'}${formatarQuantidade(Math.abs(base), item.unidade)}`
}

function DadosItem({ item, fornecedores, onSalvou }: { item: ItemEstoque; fornecedores: Fornecedor[]; onSalvou: (i: ItemEstoque) => void }) {
  const [nome, setNome] = useState(item.nome)
  const [minimo, setMinimo] = useState<ValorCampo>(campoDe(item.minimo, item.unidade))
  const [cheio, setCheio] = useState<ValorCampo>(campoDe(item.cheio, item.unidade))
  const [fornecedorId, setFornecedorId] = useState(item.fornecedor?.id ?? '')
  const [embalagemNome, setEmbalagemNome] = useState(item.embalagem?.nome ?? '')
  const [embalagem, setEmbalagem] = useState<ValorCampo>(
    item.embalagem ? campoDe(item.embalagem.quantidade, item.unidade) : campoVazio(item.unidade),
  )
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setAviso('')
    const min = lerCampo(minimo, item.unidade, true)
    const max = lerCampo(cheio, item.unidade, true)
    const porEmbalagem = embalagemNome.trim() ? lerCampo(embalagem, item.unidade) : null
    if (!nome.trim()) return setErro('Digite o nome do item')
    if (min === null || max === null) return setErro('Digite quantidades válidas')
    if (embalagemNome.trim() && porEmbalagem === null) return setErro('Diga quanto vem na embalagem')
    setErro('')
    try {
      onSalvou(
        await editarItem(item.id, {
          nome: nome.trim(),
          minimo: min,
          cheio: max,
          fornecedorId: fornecedorId || null,
          embalagemNome: embalagemNome.trim() || null,
          embalagemQuantidade: porEmbalagem,
        }),
      )
      setAviso('Item salvo')
    } catch (falha) {
      setErro(mensagemDe(falha))
    }
  }

  return (
    <form aria-label="Dados do item" className="form-estoque" onSubmit={enviar}>
      <label>
        Nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
      </label>
      <CampoQuantidade rotulo="Mínimo" rotuloUnidade="Unidade do mínimo" unidade={item.unidade} valor={minimo} onMudar={setMinimo} />
      <CampoQuantidade
        rotulo="Nível cheio"
        rotuloUnidade="Unidade do nível cheio"
        unidade={item.unidade}
        valor={cheio}
        onMudar={setCheio}
      />
      <label>
        Fornecedor
        <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
          <option value="">Sem fornecedor</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        Embalagem de compra (opcional)
        <input
          value={embalagemNome}
          onChange={(e) => setEmbalagemNome(e.target.value)}
          placeholder="Ex.: Cartela, Caixa, Barril"
          maxLength={40}
        />
      </label>
      {embalagemNome.trim() && (
        <CampoQuantidade
          rotulo="Quanto vem na embalagem"
          rotuloUnidade="Unidade da embalagem"
          unidade={item.unidade}
          valor={embalagem}
          onMudar={setEmbalagem}
        />
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      <button type="submit" className="botao botao--primario">
        Salvar item
      </button>
    </form>
  )
}

function Contagem({ item, onContou }: { item: ItemEstoque; onContou: (i: ItemEstoque) => void }) {
  const [valor, setValor] = useState<ValorCampo>(campoVazio(item.unidade))
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmar, setConfirmar] = useState<number | null>(null)

  const salvar = async (quantidade: number) => {
    setConfirmar(null)
    try {
      onContou(await contarItem(item.id, quantidade))
      setValor(campoVazio(item.unidade))
      setAviso('Contagem salva')
    } catch (falha) {
      setErro(mensagemDe(falha))
    }
  }

  const pedir = () => {
    setAviso('')
    const quantidade = lerCampo(valor, item.unidade, true)
    if (quantidade === null) return setErro('Digite uma quantidade válida')
    setErro('')
    const diferenca = quantidade - item.quantidade
    if (item.cheio > 0 && Math.abs(diferenca) > item.cheio * DIFERENCA_GRANDE) return setConfirmar(quantidade)
    void salvar(quantidade)
  }

  return (
    <section className="bloco-estoque" aria-labelledby="t-contar">
      <h3 id="t-contar">Contar estoque</h3>
      <p className="linha-estoque-sub">
        Agora no sistema: <Quantidade base={item.quantidade} unidade={item.unidade} />
      </p>
      <CampoQuantidade
        rotulo="Quantidade contada"
        rotuloUnidade="Unidade da quantidade contada"
        unidade={item.unidade}
        valor={valor}
        onMudar={setValor}
      />
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {confirmar !== null && (
        <Confirmacao
          texto={`A diferença é grande (${comSinal(confirmar - item.quantidade, item)}). Confirmar?`}
          onSim={() => void salvar(confirmar)}
          onNao={() => setConfirmar(null)}
        />
      )}
      <button type="button" className="botao botao--primario" onClick={pedir}>
        Salvar contagem
      </button>
    </section>
  )
}

export default function TelaItem({ id }: { id: string }) {
  const [item, setItem] = useState<ItemEstoque | null | undefined>(undefined)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([])
  const [arquivar, setArquivar] = useState(false)
  const [erro, setErro] = useState('')

  const carregarMovimentos = useCallback(() => {
    buscarMovimentos(id)
      .then(setMovimentos)
      .catch(() => undefined)
  }, [id])

  useEffect(() => {
    buscarItens()
      .then((itens) => setItem(itens.find((i) => i.id === id) ?? null))
      .catch((e: unknown) => setErro(mensagemDe(e)))
    buscarFornecedores()
      .then(setFornecedores)
      .catch(() => undefined)
    carregarMovimentos()
  }, [id, carregarMovimentos])

  const atualizar = (novo: ItemEstoque) => {
    setItem(novo)
    carregarMovimentos()
  }

  const confirmarArquivo = async () => {
    try {
      await arquivarItem(id)
      navegar('/estoque/itens')
    } catch (e) {
      setArquivar(false)
      setErro(mensagemDe(e))
    }
  }

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo={item?.nome ?? 'Item'} />
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {item === undefined && <p className="carregando">Carregando…</p>}
      {item === null && <p className="vazio">Item não encontrado.</p>}
      {item && (
        <>
          <p className="linha-estoque-topo">
            <Quantidade base={item.quantidade} unidade={item.unidade} />
            <SeloNivel nivel={item.nivel} />
          </p>
          <Contagem item={item} onContou={atualizar} />
          <DadosItem key={item.id} item={item} fornecedores={fornecedores} onSalvou={atualizar} />
          <section className="bloco-estoque" aria-labelledby="t-historico">
            <h3 id="t-historico">Histórico</h3>
            {movimentos.length === 0 ? (
              <p className="vazio">Nada lançado ainda.</p>
            ) : (
              <ul>
                {movimentos.map((m) => (
                  <li key={m.id} className={`linha-estoque${m.desfeito ? ' linha-estoque--desfeita' : ''}`}>
                    <span>
                      {[NOME_TIPO[m.tipo], comSinal(m.quantidade, item), m.usuario ?? 'Sistema'].join(' · ')}
                    </span>
                    <span className="linha-estoque-sub">
                      {new Date(m.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {m.motivo ? ` · ${NOME_MOTIVO[m.motivo]}` : ''}
                      {m.observacao ? ` · ${m.observacao}` : ''}
                      {m.desfeito ? ' · desfeito' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {arquivar ? (
            <Confirmacao
              texto={`Arquivar ${item.nome}? Ele sai das receitas e das listas.`}
              onSim={() => void confirmarArquivo()}
              onNao={() => setArquivar(false)}
            />
          ) : (
            <button type="button" className="botao botao--perigo" onClick={() => setArquivar(true)}>
              Arquivar item
            </button>
          )}
        </>
      )}
    </main>
  )
}
