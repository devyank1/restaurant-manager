import { useEffect, useState, type FormEvent } from 'react'
import { buscarFornecedores, buscarItens, criarItem } from '../api/estoque'
import type { Fornecedor, ItemEstoque, Unidade } from '../api/tipos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import { campoVazio, lerCampo, type ValorCampo } from './campo'
import CampoQuantidade from './CampoQuantidade'
import { BarraTitulo, Quantidade, SeloNivel } from './comum'
import { MEDIDAS, mensagemDe } from './textos'

function NovoItem({ fornecedores, onCriou }: { fornecedores: Fornecedor[]; onCriou: (i: ItemEstoque) => void }) {
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState<Unidade>('UN')
  const [minimo, setMinimo] = useState<ValorCampo>(campoVazio('UN'))
  const [cheio, setCheio] = useState<ValorCampo>(campoVazio('UN'))
  const [agora, setAgora] = useState<ValorCampo>(campoVazio('UN'))
  const [fornecedorId, setFornecedorId] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const min = lerCampo(minimo, unidade, true)
    const max = lerCampo(cheio, unidade, true)
    const inicial = agora.texto.trim() ? lerCampo(agora, unidade, true) : 0
    if (!nome.trim()) return setErro('Digite o nome do item')
    if (min === null || max === null || inicial === null) return setErro('Digite quantidades válidas')
    setErro('')
    setSalvando(true)
    try {
      onCriou(
        await criarItem({
          nome: nome.trim(),
          unidade,
          minimo: min,
          cheio: max,
          quantidade: inicial,
          fornecedorId: fornecedorId || null,
        }),
      )
    } catch (falha) {
      setErro(mensagemDe(falha))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form aria-label="Novo item" className="form-estoque" onSubmit={enviar}>
      <label>
        Nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
      </label>
      <label>
        Tipo de medida
        <select value={unidade} onChange={(e) => setUnidade(e.target.value as Unidade)}>
          {MEDIDAS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>
      <CampoQuantidade rotulo="Mínimo" rotuloUnidade="Unidade do mínimo" unidade={unidade} valor={minimo} onMudar={setMinimo} />
      <CampoQuantidade
        rotulo="Nível cheio"
        rotuloUnidade="Unidade do nível cheio"
        unidade={unidade}
        valor={cheio}
        onMudar={setCheio}
      />
      <CampoQuantidade
        rotulo="Quantidade agora"
        rotuloUnidade="Unidade da quantidade agora"
        unidade={unidade}
        valor={agora}
        onMudar={setAgora}
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
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" className="botao botao--primario" disabled={salvando}>
        Criar item
      </button>
    </form>
  )
}

export default function TelaItens() {
  const [itens, setItens] = useState<ItemEstoque[] | null>(null)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [criando, setCriando] = useState(false)

  const recarregar = useMaisRecente(() => buscarItens(), setItens)
  useEffect(() => {
    void recarregar()
    buscarFornecedores()
      .then(setFornecedores)
      .catch(() => undefined)
  }, [recarregar])
  useEquipeAoVivo({ estoque: recarregar })

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Itens" />
      <div className="estoque-acoes">
        <button type="button" className="botao botao--primario" aria-expanded={criando} onClick={() => setCriando(!criando)}>
          Novo item
        </button>
      </div>
      {criando && (
        <NovoItem
          fornecedores={fornecedores}
          onCriou={(item) => {
            setItens((lista) => [...(lista ?? []), item].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
            setCriando(false)
          }}
        />
      )}
      {itens === null ? (
        <p className="carregando">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="vazio">Nenhum item ainda. Toque em Novo item.</p>
      ) : (
        <ul className="lista-estoque">
          {itens.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="linha-estoque linha-estoque--botao"
                onClick={() => navegar(`/estoque/itens/${encodeURIComponent(i.id)}`)}
              >
                <span className="linha-estoque-topo">
                  <strong>{i.nome}</strong>
                  <Quantidade base={i.quantidade} unidade={i.unidade} />
                </span>
                <SeloNivel nivel={i.nivel} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
