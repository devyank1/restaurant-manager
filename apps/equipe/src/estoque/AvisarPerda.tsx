import { useEffect, useRef, useState } from 'react'
import { avisarPerda, buscarItens, desfazer } from '../api/estoque'
import type { ItemEstoque, MotivoPerda } from '../api/tipos'
import { campoVazio, lerCampo, type ValorCampo } from './campo'
import CampoQuantidade from './CampoQuantidade'
import { mensagemDe, NOME_MOTIVO } from './textos'
import { formatarQuantidade } from './unidades'
import '../estilo/estoque.css'

const MOTIVOS: MotivoPerda[] = ['ACIDENTE', 'VALIDADE', 'PREPARO', 'OUTRO']

type Passo = 'item' | 'quantidade' | 'motivo' | 'feito'

/** "Quebrou uma cartela de ovos": item, quanto e por quê, em 3 passos. */
export default function AvisarPerda({ onFechar }: { onFechar: () => void }) {
  const [itens, setItens] = useState<ItemEstoque[] | null>(null)
  const [busca, setBusca] = useState('')
  const [passo, setPasso] = useState<Passo>('item')
  const [item, setItem] = useState<ItemEstoque | null>(null)
  const [valor, setValor] = useState<ValorCampo>(campoVazio('UN'))
  const [quantidade, setQuantidade] = useState(0)
  const [motivo, setMotivo] = useState<MotivoPerda | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    buscarItens('perdas')
      .then(setItens)
      .catch((e: unknown) => setErro(mensagemDe(e)))
    titulo.current?.focus()
  }, [])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])

  const escolher = (i: ItemEstoque) => {
    setItem(i)
    setValor(campoVazio(i.unidade))
    setErro('')
    setPasso('quantidade')
  }

  const continuar = () => {
    if (!item) return
    const q = lerCampo(valor, item.unidade)
    if (q === null) return setErro('Digite uma quantidade maior que zero')
    setErro('')
    setQuantidade(q)
    setPasso('motivo')
  }

  const avisar = async () => {
    if (!item || !motivo) return
    setEnviando(true)
    setErro('')
    try {
      await avisarPerda({
        itemId: item.id,
        quantidade,
        motivo,
        ...(motivo === 'OUTRO' ? { observacao: observacao.trim() } : {}),
      })
      setAviso('Perda avisada')
      setPasso('feito')
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setEnviando(false)
    }
  }

  const voltarAtras = async () => {
    setErro('')
    try {
      await desfazer()
      setAviso('Perda desfeita')
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  const filtrados = (itens ?? []).filter((i) => i.nome.toLowerCase().includes(busca.trim().toLowerCase()))
  const podeAvisar = !!motivo && (motivo !== 'OUTRO' || observacao.trim().length > 0) && !enviando

  return (
    <div className="fundo-modal">
      <div role="dialog" aria-modal="true" aria-labelledby="t-perda" className="modal-perda">
        <div className="modal-perda-topo">
          <h2 id="t-perda" ref={titulo} tabIndex={-1}>
            Avisar perda
          </h2>
          <button type="button" className="voltar" onClick={onFechar}>
            Fechar
          </button>
        </div>

        {passo === 'item' && (
          <>
            <label className="campo-quantidade">
              Buscar item
              <input value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
            </label>
            {itens === null && !erro && <p className="carregando">Carregando…</p>}
            <ul className="lista-estoque">
              {filtrados.map((i) => (
                <li key={i.id}>
                  <button type="button" className="linha-estoque linha-estoque--botao" onClick={() => escolher(i)}>
                    {i.nome}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {passo === 'quantidade' && item && (
          <>
            <p className="linha-estoque-topo">
              <strong>{item.nome}</strong>
            </p>
            <CampoQuantidade
              rotulo="Quanto perdeu"
              rotuloUnidade="Unidade da perda"
              unidade={item.unidade}
              valor={valor}
              onMudar={setValor}
            />
            <div className="confirmacao-botoes">
              <button type="button" className="botao botao--secundario" onClick={() => setPasso('item')}>
                Voltar
              </button>
              <button type="button" className="botao botao--primario" onClick={continuar}>
                Continuar
              </button>
            </div>
          </>
        )}

        {passo === 'motivo' && item && (
          <>
            <p className="linha-estoque-topo">
              <strong>{`${formatarQuantidade(quantidade, item.unidade)} de ${item.nome}`}</strong>
            </p>
            <div className="chips" role="group" aria-label="Motivo">
              {MOTIVOS.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
                  {NOME_MOTIVO[m]}
                </button>
              ))}
            </div>
            {motivo === 'OUTRO' && (
              <label className="campo-quantidade">
                O que aconteceu?
                <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={300} rows={3} />
              </label>
            )}
            <div className="confirmacao-botoes">
              <button type="button" className="botao botao--secundario" onClick={() => setPasso('quantidade')}>
                Voltar
              </button>
              <button type="button" className="botao botao--perigo" disabled={!podeAvisar} onClick={avisar}>
                Avisar
              </button>
            </div>
          </>
        )}

        {passo === 'feito' && (
          <>
            <p role="status">{aviso}</p>
            <div className="confirmacao-botoes">
              {aviso === 'Perda avisada' && (
                <button type="button" className="botao botao--secundario" onClick={voltarAtras}>
                  Desfazer
                </button>
              )}
              <button type="button" className="botao botao--primario" onClick={onFechar}>
                Pronto
              </button>
            </div>
          </>
        )}

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </div>
  )
}
