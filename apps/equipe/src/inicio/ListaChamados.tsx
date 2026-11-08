import { useEffect, useState } from 'react'
import { ErroEquipe, marcarLido, resolverChamado } from '../api/equipe'
import type { ChamadoEquipe } from '../api/tipos'
import { navegar } from '../rotas'
import { haQuanto } from './tempo'

const TIPO: Record<ChamadoEquipe['tipo'], string> = {
  ATENDENTE: 'Chamou o atendente',
  CONFIRMAR_RODADA: 'Novo pedido para confirmar',
}

export default function ListaChamados({
  chamados,
  onMudou,
}: {
  chamados: ChamadoEquipe[]
  /** Pede para buscar a lista de novo (depois de agir ou de um 403/404). */
  onMudou: () => void
}) {
  // Atualiza o "há N min" a cada 30 s.
  const [, setTique] = useState(0)
  useEffect(() => {
    const relogio = setInterval(() => setTique((n) => n + 1), 30_000)
    return () => clearInterval(relogio)
  }, [])

  // Erro de "outro garçom pegou" ou "já resolvido": a lista do servidor manda.
  const agir = async (acao: () => Promise<unknown>) => {
    try {
      await acao()
    } catch (erro) {
      if (!(erro instanceof ErroEquipe)) return
    }
    onMudou()
  }

  const abrir = (c: ChamadoEquipe) => {
    if (c.tipo === 'CONFIRMAR_RODADA') navegar(`/mesa/${encodeURIComponent(c.mesa.token)}`)
    if (c.status === 'ABERTO') void agir(() => marcarLido(c.id))
  }

  if (chamados.length === 0) return <p className="vazio">Nenhum chamado agora</p>

  return (
    <ul className="chamados" aria-label="Chamados">
      {chamados.map((c) => (
        <li key={c.id} className={`chamado${c.status === 'ABERTO' ? ' chamado--novo' : ''}`}>
          <button type="button" className="chamado-abrir" onClick={() => abrir(c)}>
            <span className="chamado-mesa">{`Mesa ${c.mesa.numero}`}</span>
            <span className="chamado-tipo">{TIPO[c.tipo]}</span>
            <span className="chamado-info">
              <span>{haQuanto(c.criadoEm)}</span>
              {c.paraTodos && <span className="selo">Para todos</span>}
              {c.tentativas > 1 && <span className="selo selo--alerta">Repassado</span>}
            </span>
          </button>
          {c.tipo === 'ATENDENTE' && (
            <button type="button" className="botao botao--sucesso" onClick={() => void agir(() => resolverChamado(c.id))}>
              Atendido
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
