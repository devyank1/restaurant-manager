import { formatarReais } from '@cardapio/opcoes'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CardapioPublico } from '../api/cardapio'
import { buscarCardapio, buscarChamados, buscarMesa, ErroEquipe, ErroNaoAutenticado, marcarLido } from '../api/equipe'
import type { MesaEquipe } from '../api/tipos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import ContaMesa from './ContaMesa'
import RodadaConfirmada from './RodadaConfirmada'
import RodadaPendente from './RodadaPendente'

const JA_FECHADA = 'Este pedido já foi confirmado ou recusado'
/** 409 da API ao editar rodada que já saiu de AGUARDANDO_GARCOM. */
const RODADA_FECHADA_API = 'Esta rodada já foi confirmada ou recusada'
const SEM_CONEXAO = 'Sem conexão. Tente de novo.'
const DURACAO_AVISO_MS = 4000

export default function TelaMesa({ token }: { token: string }) {
  const [mesa, setMesa] = useState<MesaEquipe | null>(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [cardapio, setCardapio] = useState<CardapioPublico | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)
  const [naConta, setNaConta] = useState(false)

  // Falha de rede: mantém o que já tinha; a reconexão busca de novo.
  const recarregar = useMaisRecente(
    () => buscarMesa(token),
    (atual) => {
      setMesa(atual)
      setNaoEncontrada(false)
    },
    (erro) => {
      if (erro instanceof ErroEquipe && erro.status === 404) setNaoEncontrada(true)
    },
  )

  // Cardápio (para Editar e Adicionar): se falhou, tenta de novo a cada atualização.
  const temCardapio = useRef(false)
  const carregarCardapio = useCallback(() => {
    if (temCardapio.current) return
    buscarCardapio(token).then((c) => {
      temCardapio.current = true
      setCardapio(c)
    }, () => undefined)
  }, [token])

  // Garçom na tela da mesa = chamado visto: marca lido para não ser repassado
  // (abrir pela notificação, pela etiqueta ou pela lista dá no mesmo).
  const marcarLidosDaMesa = useCallback(() => {
    buscarChamados()
      .then((chamados) =>
        Promise.all(
          chamados
            .filter((c) => c.mesa.token === token && c.status === 'ABERTO')
            .map((c) => marcarLido(c.id).catch(() => undefined)),
        ),
      )
      .catch(() => undefined)
  }, [token])

  useEffect(() => {
    void recarregar()
    carregarCardapio()
    marcarLidosDaMesa()
  }, [recarregar, carregarCardapio, marcarLidosDaMesa])

  useEquipeAoVivo({
    mesas: () => {
      void recarregar()
      carregarCardapio()
    },
    chamados: marcarLidosDaMesa,
  })

  // Outro garçom fechou: sai da conta (e não reabre sozinha para o próximo grupo).
  const aberta = mesa?.aberta
  useEffect(() => {
    if (aberta === false) setNaConta(false)
  }, [aberta])

  useEffect(() => {
    if (!aviso) return
    const relogio = setTimeout(() => setAviso(null), DURACAO_AVISO_MS)
    return () => clearTimeout(relogio)
  }, [aviso])

  /** Roda a ação; qualquer recusa do servidor vira aviso e a mesa é relida. */
  const agir = (acao: () => Promise<unknown>) => {
    setOcupado(true)
    acao()
      .catch((erro: unknown) => {
        if (erro instanceof ErroNaoAutenticado) return
        const texto =
          erro instanceof ErroEquipe ? (erro.message === RODADA_FECHADA_API ? JA_FECHADA : erro.message) : SEM_CONEXAO
        setAviso({ texto, id: Date.now() })
      })
      .finally(() => {
        void recarregar().finally(() => setOcupado(false))
      })
  }

  const voltar = (
    <button type="button" className="voltar" onClick={() => navegar('/')}>
      ‹ Início
    </button>
  )

  if (naoEncontrada) {
    return (
      <main className="tela-mesa">
        {voltar}
        <p className="vazio">Mesa não encontrada</p>
      </main>
    )
  }
  if (!mesa) return <p className="carregando">Carregando…</p>

  const avisoNaTela = aviso && (
    <p className="aviso" role="status">
      {aviso.texto}
    </p>
  )

  if (naConta && mesa.aberta) {
    return (
      <main className="tela-mesa">
        <div className="barra-titulo">
          <h2>{`Conta · Mesa ${mesa.mesa.numero}`}</h2>
        </div>
        <ContaMesa mesa={mesa} ocupado={ocupado} agir={agir} onVoltar={() => setNaConta(false)} />
        {avisoNaTela}
      </main>
    )
  }

  const pendentes = mesa.rodadas.filter((r) => r.status === 'AGUARDANDO_GARCOM')
  const confirmadas = mesa.rodadas.filter((r) => r.status === 'CONFIRMADA')
  const canceladas = mesa.rodadas.filter((r) => r.status === 'CANCELADA')

  return (
    <main className="tela-mesa">
      <div className="barra-titulo">
        {voltar}
        <h2>{`Mesa ${mesa.mesa.numero}`}</h2>
        <span className="mesa-quem">{mesa.garcomNome ?? 'Sem garçom'}</span>
      </div>

      {mesa.rodadas.length === 0 && <p className="vazio">Mesa livre</p>}

      {pendentes.map((r) => (
        <RodadaPendente key={r.id} rodada={r} cardapio={cardapio} ocupado={ocupado} agir={agir} />
      ))}

      {confirmadas.map((r) => (
        <RodadaConfirmada key={r.id} rodada={r} ocupado={ocupado} agir={agir} />
      ))}

      {canceladas.length > 0 && (
        <section className="rodadas-fechadas" aria-label="Pedidos recusados">
          {canceladas.map((r) => (
            <div key={r.id} className="rodada rodada--cancelada">
              <div className="rodada-topo">
                <span className="rodada-status">Recusado</span>
                <span>{formatarReais(r.totalCentavos)}</span>
              </div>
              <ul className="itens itens--compacto">
                {r.itens.map((i) => (
                  <li key={i.id}>
                    {`${i.quantidade}× `}
                    <span>{i.nome}</span>
                    {i.resumoOpcoes && <span className="item-opcoes">{` (${i.resumoOpcoes})`}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {mesa.rodadas.length > 0 && (
        <p className="total-parcial">
          Total parcial <strong>{formatarReais(mesa.totalConfirmadoCentavos)}</strong>
        </p>
      )}

      {mesa.aberta && (
        <button type="button" className="botao botao--secundario" onClick={() => setNaConta(true)}>
          Fechar conta
        </button>
      )}

      {avisoNaTela}
    </main>
  )
}
