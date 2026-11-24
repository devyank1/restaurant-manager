// Peças comuns dos painéis (dono e garçom): meta da equipe e cartão da pessoa.
import type { CartaoPessoa, ProgressoMeta } from '../api/tipos'
import { navegar } from '../rotas'
import '../estilo/paineis.css'
import BarraMeta from './BarraMeta'
import { textoTurno } from './numeros'

const ROTULO_EQUIPE: Record<string, string> = {
  VALOR: 'Valor vendido pela equipe',
  MESAS: 'Mesas atendidas pela equipe',
}
const ROTULO_PESSOA: Record<string, string> = {
  VALOR: 'Valor vendido',
  MESAS: 'Mesas atendidas',
}

/** Bloco "Meta da equipe" (topo de todos os painéis). */
export function MetaEquipe({ metas, dono }: { metas: ProgressoMeta[]; dono: boolean }) {
  return (
    <section className="bloco-painel bloco-painel--meta" aria-labelledby="t-meta-equipe-painel">
      <h2 id="t-meta-equipe-painel">Meta da equipe</h2>
      {metas.length === 0 ? (
        <p className="vazio">
          Sem meta da equipe.{' '}
          {dono && (
            <button type="button" className="link-botao" onClick={() => navegar('/metas')}>
              Definir em Metas
            </button>
          )}
        </p>
      ) : (
        metas.map((m) => <BarraMeta key={m.tipo} meta={m} rotulo={ROTULO_EQUIPE[m.tipo] ?? 'Meta'} />)
      )}
    </section>
  )
}

/** Cartão de uma pessoa: avisos de cuidado no topo, turno e metas. */
export function Cartao({ p }: { p: CartaoPessoa }) {
  return (
    <article className="cartao-pessoa" aria-label={p.nome}>
      {p.avisos.map((a) => (
        <p key={a} className="aviso-cuidado">
          {a}
        </p>
      ))}
      <h3>{p.nome}</h3>
      <p className="cartao-pessoa-turno">
        {textoTurno(p.emTurno, p.emTurnoDesde)}
        {` · ${p.mesasHoje} ${p.mesasHoje === 1 ? 'mesa' : 'mesas'} hoje`}
      </p>
      {p.metas.length === 0 ? (
        <p className="vazio">Sem meta definida</p>
      ) : (
        p.metas.map((m) => <BarraMeta key={m.tipo} meta={m} rotulo={ROTULO_PESSOA[m.tipo] ?? 'Meta'} />)
      )}
    </article>
  )
}
