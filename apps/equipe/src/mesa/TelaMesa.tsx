import { formatarReais } from '@cardapio/opcoes'
import { useCallback, useEffect, useState } from 'react'
import type { CardapioPublico } from '../api/cardapio'
import { buscarCardapio, buscarMesa, ErroEquipe, ErroNaoAutenticado } from '../api/equipe'
import type { MesaEquipe, RodadaEquipe } from '../api/tipos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import RodadaPendente from './RodadaPendente'

const JA_FECHADA = 'Este pedido já foi confirmado ou recusado'
const SEM_CONEXAO = 'Sem conexão. Tente de novo.'
const DURACAO_AVISO_MS = 4000

const STATUS: Record<RodadaEquipe['status'], string> = {
  AGUARDANDO_GARCOM: 'Aguardando',
  CONFIRMADA: 'Confirmado',
  CANCELADA: 'Recusado',
}

export default function TelaMesa({ token }: { token: string }) {
  const [mesa, setMesa] = useState<MesaEquipe | null>(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [cardapio, setCardapio] = useState<CardapioPublico | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)

  // Falha de rede: mantém o que já tinha; a reconexão busca de novo.
  const recarregar = useCallback(
    () =>
      buscarMesa(token).then(
        (atual) => {
          setMesa(atual)
          setNaoEncontrada(false)
        },
        (erro: unknown) => {
          if (erro instanceof ErroEquipe && erro.status === 404) setNaoEncontrada(true)
        },
      ),
    [token],
  )

  useEffect(() => {
    void recarregar()
    buscarCardapio(token).then(setCardapio, () => undefined)
  }, [recarregar, token])

  useEquipeAoVivo({ mesas: () => void recarregar() })

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
          erro instanceof ErroEquipe ? (erro.status === 409 ? JA_FECHADA : erro.message) : SEM_CONEXAO
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

  const pendentes = mesa.rodadas.filter((r) => r.status === 'AGUARDANDO_GARCOM')
  const fechadas = mesa.rodadas.filter((r) => r.status !== 'AGUARDANDO_GARCOM')

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

      {fechadas.length > 0 && (
        <section className="rodadas-fechadas" aria-label="Pedidos da mesa">
          {fechadas.map((r) => (
            <div key={r.id} className={`rodada rodada--${r.status.toLowerCase()}`}>
              <div className="rodada-topo">
                <span className="rodada-status">{STATUS[r.status]}</span>
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

      {aviso && (
        <p className="aviso" role="status">
          {aviso.texto}
        </p>
      )}
    </main>
  )
}
