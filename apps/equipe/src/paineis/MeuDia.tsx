import { useEffect, useState } from 'react'
import { buscarMeuPainel } from '../api/paineis'
import type { PainelGarcom } from '../api/tipos'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import '../estilo/paineis.css'
import BarraMeta from './BarraMeta'
import { textoTurno } from './numeros'
import { MetaEquipe } from './pecas'

const ROTULO: Record<string, string> = { VALOR: 'Valor vendido', MESAS: 'Mesas atendidas' }

/** O dia do garçom: meta da equipe, as dele, mesas e turno. Nada de colegas [spec §4.4]. */
export default function MeuDia() {
  const [painel, setPainel] = useState<PainelGarcom | null>(null)
  // Falha de rede: mantém o que já tinha (o painel não trava o trabalho).
  const recarregar = useMaisRecente(buscarMeuPainel, setPainel)
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  useEquipeAoVivo({ painel: recarregar })

  if (!painel) return null
  const { eu } = painel
  return (
    <div className="painel">
      <MetaEquipe metas={painel.metaEquipe} dono={false} />
      <section className="bloco-painel" aria-labelledby="t-minhas-metas">
        <h2 id="t-minhas-metas">Minhas metas</h2>
        {eu.avisos.map((a) => (
          <p key={a} className="aviso-cuidado">
            {a}
          </p>
        ))}
        {eu.metas.length === 0 ? (
          <p className="vazio">Sem meta definida</p>
        ) : (
          eu.metas.map((m) => <BarraMeta key={m.tipo} meta={m} rotulo={ROTULO[m.tipo] ?? 'Meta'} />)
        )}
        <p className="cartao-pessoa-turno">{`Mesas atendidas hoje: ${eu.mesasHoje}`}</p>
        <p className="cartao-pessoa-turno">{textoTurno(eu.emTurno, eu.emTurnoDesde)}</p>
      </section>
    </div>
  )
}
