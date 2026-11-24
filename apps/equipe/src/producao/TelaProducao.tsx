import { useEffect, useRef, useState } from 'react'
import { buscarProducao, ErroEquipe, ErroNaoAutenticado, mudarItemProducao, mudarRodadaProducao } from '../api/equipe'
import type { FilaProducao, PedidoProducao } from '../api/tipos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import CartaoPedido from './CartaoPedido'
import { liberarSom, manterTelaLigada, tocarBipe } from './somEPresenca'
import '../estilo/producao.css'

const CHAVE_ESTACAO = 'estacao'
const DURACAO_AVISO_MS = 4000
const TIQUE_MS = 30_000

function lerEstacao(): string | undefined {
  try {
    return localStorage.getItem(CHAVE_ESTACAO) ?? undefined
  } catch {
    return undefined
  }
}

function guardarEstacao(estacao: string) {
  try {
    localStorage.setItem(CHAVE_ESTACAO, estacao)
  } catch {
    // Sem storage: só não lembra na próxima vez.
  }
}

const emAndamento = (p: PedidoProducao) =>
  p.cancelada || p.itens.some((i) => i.status === 'NA_FILA' || i.status === 'EM_PREPARO')

/** Tela da cozinha/bar: fila da estação por ordem de chegada. */
export default function TelaProducao() {
  const [estacao, setEstacao] = useState(lerEstacao)
  const [fila, setFila] = useState<FilaProducao | null>(null)
  const [escondidos, setEscondidos] = useState<Set<string>>(() => new Set())
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)
  const [comSom, setComSom] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  // Pedidos já vistos nesta estação: só os novos tocam o bipe.
  const conhecidos = useRef<{ estacao: string; ids: Set<string> } | null>(null)
  const somLigado = useRef(false)

  const atual = fila && (estacao && fila.estacoes.includes(estacao) ? estacao : fila.estacoes[0])

  const recarregar = useMaisRecente(
    () => buscarProducao(estacao),
    (nova) => {
      const daVez = estacao && nova.estacoes.includes(estacao) ? estacao : (nova.estacoes[0] ?? '')
      const ids = new Set(nova.pedidos.filter((p) => !p.cancelada).map((p) => p.rodadaId))
      const antes = conhecidos.current
      if (antes && antes.estacao === daVez && somLigado.current) {
        if ([...ids].some((id) => !antes.ids.has(id))) tocarBipe()
      }
      conhecidos.current = { estacao: daVez, ids }
      setFila(nova)
      setAgora(Date.now())
    },
  )

  useEffect(() => {
    void recarregar()
  }, [recarregar, estacao])
  useEquipeAoVivo({ producao: recarregar })

  useEffect(() => manterTelaLigada(), [])

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), TIQUE_MS)
    return () => clearInterval(relogio)
  }, [])

  useEffect(() => {
    if (!aviso) return
    const relogio = setTimeout(() => setAviso(null), DURACAO_AVISO_MS)
    return () => clearTimeout(relogio)
  }, [aviso])

  const agir = (acao: () => Promise<unknown>) => {
    setOcupado(true)
    acao()
      .catch((erro: unknown) => {
        if (erro instanceof ErroNaoAutenticado) return
        const texto = erro instanceof ErroEquipe ? erro.message : 'Sem conexão. Tente de novo.'
        setAviso({ texto, id: Date.now() })
      })
      .finally(() => {
        void recarregar().finally(() => setOcupado(false))
      })
  }

  const escolher = (nova: string) => {
    guardarEstacao(nova)
    setEstacao(nova)
  }

  const ativarSom = () => {
    somLigado.current = liberarSom()
    setComSom(somLigado.current)
  }

  if (!fila || !atual) {
    return <p className="carregando">{fila ? 'Nenhuma estação cadastrada' : 'Carregando…'}</p>
  }

  const visiveis = fila.pedidos.filter((p) => !escondidos.has(p.rodadaId))
  const andando = visiveis.filter(emAndamento)
  const prontos = visiveis.filter((p) => !emAndamento(p))

  const cartao = (p: PedidoProducao) => (
    <CartaoPedido
      key={p.rodadaId}
      pedido={p}
      agora={agora}
      ocupado={ocupado}
      onItem={(itemId, status) => agir(() => mudarItemProducao(itemId, status))}
      onEstacao={(status) => agir(() => mudarRodadaProducao(p.rodadaId, atual, status))}
      onOk={() => setEscondidos((s) => new Set(s).add(p.rodadaId))}
    />
  )

  return (
    <main className="producao">
      <div className="producao-barra">
        <div className="producao-estacoes" role="group" aria-label="Estação">
          {fila.estacoes.map((e) => (
            <button
              key={e}
              type="button"
              className={`chip-estacao${e === atual ? ' chip-estacao--ativo' : ''}`}
              aria-pressed={e === atual}
              onClick={() => escolher(e)}
            >
              {e}
            </button>
          ))}
        </div>
        {!comSom && (
          <button type="button" className="botao botao--secundario" onClick={ativarSom}>
            Ativar som
          </button>
        )}
        <button
          type="button"
          className="botao botao--secundario"
          onClick={() => navegar(`/hoje/${encodeURIComponent(atual)}`)}
        >
          Hoje
        </button>
      </div>

      {andando.length === 0 ? (
        <p className="vazio">Nenhum pedido na fila</p>
      ) : (
        <div className="grade-producao">{andando.map(cartao)}</div>
      )}

      {prontos.length > 0 && (
        <section className="producao-prontos" aria-label="Prontos">
          <h2>{`Prontos (${prontos.length})`}</h2>
          <div className="grade-producao">{prontos.map(cartao)}</div>
        </section>
      )}

      {aviso && (
        <p className="aviso" role="status">
          {aviso.texto}
        </p>
      )}
    </main>
  )
}
