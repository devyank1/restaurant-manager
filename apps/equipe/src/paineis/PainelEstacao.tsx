import { useEffect, useState } from 'react'
import { buscarPainelEstacao } from '../api/paineis'
import type { PainelEstacao as Painel } from '../api/tipos'
import { mensagemDe } from '../estoque/textos'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import '../estilo/paineis.css'
import BarraMeta from './BarraMeta'
import { MetaEquipe } from './pecas'

const ROTULO: Record<string, string> = { NO_TEMPO: '% no tempo', ESQUECIDOS: 'Zero esquecidos' }

/** "Hoje" da cozinha/bar: dia em andamento, sem nomes [spec §4.5]. */
export default function PainelEstacao({ estacao }: { estacao: string }) {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [erro, setErro] = useState('')
  const recarregar = useMaisRecente(
    () => buscarPainelEstacao(estacao),
    (p) => {
      setPainel(p)
      setErro('')
    },
    (e) => setErro(mensagemDe(e)),
  )
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  useEquipeAoVivo({ painel: recarregar, producao: recarregar })

  return (
    <main className="inicio painel">
      <h1 className="titulo-painel">{`Hoje · ${estacao}`}</h1>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {painel === null && !erro && <p className="carregando">Carregando…</p>}
      {painel && (
        <>
          <MetaEquipe metas={painel.metaEquipe} dono={false} />
          <section className="bloco-painel" aria-labelledby="t-meta-estacao">
            <h2 id="t-meta-estacao">Meta da estação</h2>
            {painel.metas.length === 0 ? (
              <p className="vazio">Sem meta da estação.</p>
            ) : (
              painel.metas.map((m) => <BarraMeta key={m.tipo} meta={m} rotulo={ROTULO[m.tipo] ?? 'Meta'} />)
            )}
          </section>
          <section className="bloco-painel" aria-labelledby="t-numeros-estacao">
            <h2 id="t-numeros-estacao">Pedidos</h2>
            <p>{`Pedidos hoje: ${painel.medida.pedidos}`}</p>
            <p>{`No tempo: ${painel.medida.noTempoPct === null ? '—' : `${painel.medida.noTempoPct}%`}`}</p>
            {painel.medida.mediaMin !== null && <p>{`Tempo médio: ${painel.medida.mediaMin} min`}</p>}
          </section>
          <section className="bloco-painel" aria-labelledby="t-esquecidos">
            <h2 id="t-esquecidos">Esquecidos</h2>
            {painel.medida.esquecidos.length === 0 ? (
              <p className="vazio">Nenhum pedido esquecido hoje.</p>
            ) : (
              <ul className="lista-simples">
                {painel.medida.esquecidos.map((e) => (
                  <li key={e.rodadaId}>{`Mesa ${e.mesa} · ${e.minutos} min`}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
