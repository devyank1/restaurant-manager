import { useEffect, useState, type FormEvent } from 'react'
import { buscarFornecedores, criarFornecedor, editarFornecedor, excluirFornecedor } from '../api/estoque'
import type { Fornecedor } from '../api/tipos'
import { BarraTitulo, Confirmacao } from './comum'
import { mensagemDe } from './textos'
import { linkWhatsApp } from './whatsapp'

type Rascunho = { id: string | null; nome: string; telefone: string; observacao: string }
const NOVO: Rascunho = { id: null, nome: '', telefone: '', observacao: '' }

export default function TelaFornecedores() {
  const [lista, setLista] = useState<Fornecedor[] | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [excluir, setExcluir] = useState<Fornecedor | null>(null)
  const [erro, setErro] = useState('')

  const carregar = () =>
    buscarFornecedores()
      .then(setLista)
      .catch((e: unknown) => setErro(mensagemDe(e)))

  useEffect(() => {
    void carregar()
  }, [])

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!rascunho) return
    if (!rascunho.nome.trim()) return setErro('Digite o nome do fornecedor')
    setErro('')
    const dados = {
      nome: rascunho.nome.trim(),
      telefone: rascunho.telefone.trim() || null,
      observacao: rascunho.observacao.trim() || null,
    }
    try {
      if (rascunho.id) await editarFornecedor(rascunho.id, dados)
      else await criarFornecedor(dados)
      setRascunho(null)
      await carregar()
    } catch (falha) {
      setErro(mensagemDe(falha))
    }
  }

  const confirmarExclusao = async () => {
    if (!excluir) return
    try {
      await excluirFornecedor(excluir.id)
      setExcluir(null)
      await carregar()
    } catch (falha) {
      setErro(mensagemDe(falha))
    }
  }

  const mudar = (campo: keyof Rascunho, valor: string) => setRascunho((r) => r && { ...r, [campo]: valor })

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Fornecedores" />
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {rascunho ? (
        <form aria-label={rascunho.id ? 'Editar fornecedor' : 'Novo fornecedor'} className="form-estoque" onSubmit={salvar}>
          <label>
            Nome
            <input value={rascunho.nome} onChange={(e) => mudar('nome', e.target.value)} maxLength={80} />
          </label>
          <label>
            Telefone (WhatsApp)
            <input inputMode="tel" value={rascunho.telefone} onChange={(e) => mudar('telefone', e.target.value)} maxLength={30} />
          </label>
          <label>
            Observação
            <input value={rascunho.observacao} onChange={(e) => mudar('observacao', e.target.value)} maxLength={200} />
          </label>
          <div className="confirmacao-botoes">
            <button type="button" className="botao botao--secundario" onClick={() => setRascunho(null)}>
              Cancelar
            </button>
            <button type="submit" className="botao botao--primario">
              Salvar fornecedor
            </button>
          </div>
        </form>
      ) : (
        <div className="estoque-acoes">
          <button type="button" className="botao botao--primario" onClick={() => setRascunho(NOVO)}>
            Novo fornecedor
          </button>
        </div>
      )}
      {excluir && (
        <Confirmacao
          texto={`Excluir ${excluir.nome}? Os itens dele ficam sem fornecedor.`}
          onSim={() => void confirmarExclusao()}
          onNao={() => setExcluir(null)}
        />
      )}
      {lista === null ? (
        <p className="carregando">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="vazio">Nenhum fornecedor ainda.</p>
      ) : (
        <ul className="lista-estoque">
          {lista.map((f) => (
            <li key={f.id} className="linha-estoque">
              <div className="linha-estoque-topo">
                <strong>{f.nome}</strong>
                {f.telefone && <span>{f.telefone}</span>}
              </div>
              {f.observacao && <span className="linha-estoque-sub">{f.observacao}</span>}
              {f.telefone && (
                <a
                  className="botao botao--sucesso"
                  href={linkWhatsApp(f.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Chamar ${f.nome} no WhatsApp`}
                >
                  Chamar no WhatsApp
                </a>
              )}
              <div className="confirmacao-botoes">
                <button
                  type="button"
                  className="botao botao--secundario"
                  aria-label={`Editar ${f.nome}`}
                  onClick={() =>
                    setRascunho({ id: f.id, nome: f.nome, telefone: f.telefone ?? '', observacao: f.observacao ?? '' })
                  }
                >
                  Editar
                </button>
                <button type="button" className="botao botao--perigo" aria-label={`Excluir ${f.nome}`} onClick={() => setExcluir(f)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
