import { formatarReais } from '@cardapio/opcoes'
import { useEffect, useState } from 'react'
import { buscarPainel } from '../api/paineis'
import type { PainelEquipe as Painel, PeriodoMeta } from '../api/tipos'
import { mensagemDe, NOME_MOTIVO } from '../estoque/textos'
import { formatarQuantidade } from '../estoque/unidades'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import '../estilo/estoque.css'
import '../estilo/paineis.css'
import { Cartao, MetaEquipe } from './pecas'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Barras horizontais simples (CSS), proporcionais ao maior valor. */
function Barras({ rotulo, linhas }: { rotulo: string; linhas: { nome: string; valor: number; texto: string }[] }) {
  const maior = Math.max(1, ...linhas.map((l) => l.valor))
  return (
    <ul className="barras" aria-label={rotulo}>
      {linhas.map((l) => (
        <li key={l.nome} className="barras-linha">
          <span className="barras-nome">{l.nome}</span>
          <span className="barras-trilho" aria-hidden="true">
            <span className="barras-cheio" style={{ width: `${(100 * l.valor) / maior}%` }} />
          </span>
          <span className="barras-valor">{l.texto}</span>
        </li>
      ))}
    </ul>
  )
}

function Operacao({ o }: { o: Painel['operacao'] }) {
  return (
    <section className="bloco-painel" aria-labelledby="t-operacao">
      <h2 id="t-operacao">Operação</h2>
      <dl className="numeros-grandes">
        <div>
          <dt>Faturamento</dt>
          <dd>{formatarReais(o.faturamentoCentavos)}</dd>
        </div>
        <div>
          <dt>Contas</dt>
          <dd>{o.contas}</dd>
        </div>
        <div>
          <dt>Ticket médio</dt>
          <dd>{o.ticketMedioCentavos === null ? '—' : formatarReais(o.ticketMedioCentavos)}</dd>
        </div>
      </dl>

      <h3>Movimento por hora</h3>
      {o.porHora.length === 0 ? (
        <p className="vazio">Nenhum pedido ainda.</p>
      ) : (
        <Barras
          rotulo="Movimento por hora"
          linhas={o.porHora.map((h) => ({ nome: `${h.hora}h`, valor: h.rodadas, texto: String(h.rodadas) }))}
        />
      )}

      <h3>Movimento por dia da semana</h3>
      <p className="linha-estoque-sub">Média de pedidos das últimas 4 semanas.</p>
      <Barras
        rotulo="Movimento por dia da semana"
        linhas={o.porDiaSemana.map((d) => ({
          nome: DIAS[d.dia],
          valor: d.mediaRodadas,
          texto: d.mediaRodadas.toLocaleString('pt-BR'),
        }))}
      />

      <h3 id="t-mais-pedidos">Mais pedidos</h3>
      {o.maisVendidos.length === 0 ? (
        <p className="vazio">Nenhum pedido ainda.</p>
      ) : (
        <ol className="lista-numerada" aria-labelledby="t-mais-pedidos">
          {o.maisVendidos.map((m) => (
            <li key={m.nome}>{`${m.nome} · ${m.quantidade}`}</li>
          ))}
        </ol>
      )}

      <h3>Cozinha e bar</h3>
      {o.estacoes.length === 0 ? (
        <p className="vazio">Nenhum pedido ainda.</p>
      ) : (
        <ul className="lista-simples">
          {o.estacoes.map((e) => (
            <li key={e.estacao}>
              <strong>{e.estacao}</strong>
              {` · ${e.noTempoPct === null ? 'sem medida ainda' : `${e.noTempoPct}% no tempo`}`}
              {e.mediaMin !== null && ` · média ${e.mediaMin} min`}
              {` · ${e.esquecidos.length === 0 ? 'nenhum esquecido' : `${e.esquecidos.length} esquecidos`}`}
            </li>
          ))}
        </ul>
      )}

      <h3>Chamados que demoraram (mais de 3 min)</h3>
      <p>
        {o.chamadosDemorados.quantidade === 0
          ? 'Nenhum chamado demorou.'
          : `${o.chamadosDemorados.quantidade} ${o.chamadosDemorados.quantidade === 1 ? 'chamado demorou' : 'chamados demoraram'}`}
        {o.chamadosDemorados.mediaRespostaSeg !== null &&
          ` · resposta média ${Math.round(o.chamadosDemorados.mediaRespostaSeg / 60)} min`}
      </p>

      <h3>Perdas da semana</h3>
      {o.perdasSemana.length === 0 ? (
        <p className="vazio">Nenhuma perda na semana.</p>
      ) : (
        <ul className="lista-simples">
          {o.perdasSemana.map((p) => (
            <li key={`${p.item}-${p.motivo ?? ''}`}>
              {`${p.item} · ${formatarQuantidade(p.quantidade, p.unidade)}${p.motivo ? ` · ${NOME_MOTIVO[p.motivo]}` : ''}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Início do dono: meta da equipe, atalhos, cartões por pessoa e operação [spec §4.3]. */
export default function PainelEquipe({ atencao }: { atencao: number }) {
  const [periodo, setPeriodo] = useState<PeriodoMeta>('DIA')
  const [painel, setPainel] = useState<Painel | null>(null)
  const [erro, setErro] = useState('')

  const recarregar = useMaisRecente(
    () => buscarPainel(periodo),
    (p) => {
      setPainel(p)
      setErro('')
    },
    (e) => setErro(mensagemDe(e)),
  )
  useEffect(() => {
    void recarregar()
  }, [recarregar, periodo])
  useEquipeAoVivo({ painel: recarregar })

  return (
    <div className="painel">
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {painel === null && !erro && <p className="carregando">Carregando…</p>}
      {painel && <MetaEquipe metas={painel.metaEquipe} dono />}

      <nav className="atalhos" aria-label="Atalhos">
        <button type="button" className="botao botao--primario" onClick={() => navegar('/estoque')}>
          {atencao > 0 ? `Estoque · ${atencao} acabando` : 'Estoque'}
        </button>
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/metas')}>
          Metas
        </button>
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/tempos')}>
          Tempo de preparo
        </button>
      </nav>

      {painel && (
        <>
          <div className="chips" role="group" aria-label="Período">
            {(['DIA', 'SEMANA'] as const).map((p) => (
              <button key={p} type="button" className="chip" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
                {p === 'DIA' ? 'Hoje' : 'Semana'}
              </button>
            ))}
          </div>

          <section className="bloco-painel" aria-labelledby="t-equipe">
            <h2 id="t-equipe">Equipe</h2>
            {painel.pessoas.length === 0 ? (
              <p className="vazio">Ninguém trabalhou no período.</p>
            ) : (
              <div className="cartoes-pessoas">
                {painel.pessoas.map((p) => (
                  <Cartao key={p.id} p={p} />
                ))}
              </div>
            )}
          </section>

          <Operacao o={painel.operacao} />
        </>
      )}
    </div>
  )
}
