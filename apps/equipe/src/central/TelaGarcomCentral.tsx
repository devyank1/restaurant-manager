import { useEffect, useState } from 'react'
import { buscarDetalheGarcom } from '../api/paineis'
import type { DetalheGarcom } from '../api/tipos'
import { BarraTitulo } from '../estoque/comum'
import { mensagemDe } from '../estoque/textos'
import '../estilo/central.css'
import '../estilo/estoque.css'

const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))

/** O que um garçom carrega agora. Só cuidado: sem ranking nem comparação. */
export default function TelaGarcomCentral({ id }: { id: string }) {
  const [d, setD] = useState<DetalheGarcom | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    buscarDetalheGarcom(id)
      .then(setD)
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [id])

  const turno = d?.emTurno
    ? d.horasEmTurno === null
      ? 'Em turno'
      : `Em turno há ${d.horasEmTurno.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
    : 'Fora de turno'

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo={d?.nome ?? 'Garçom'} />
      {erro && (
        <p className="central-erro" role="alert">
          {erro}
        </p>
      )}
      {!d && !erro && <p className="carregando">Carregando…</p>}
      {d && (
        <>
          <p className="linha-estoque-sub">{turno}</p>
          <section className="bloco-estoque" aria-labelledby="t-mesas-g">
            <h3 id="t-mesas-g">Mesas abertas</h3>
            {d.mesasAbertas.length === 0 ? (
              <p className="vazio">Nenhuma mesa aberta</p>
            ) : (
              <ul className="lista-estoque">
                {d.mesasAbertas.map((m) => (
                  <li key={m.numero}>{`Mesa ${m.numero}, aberta há ${minutosDesde(m.abertaEm)} min`}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="bloco-estoque" aria-labelledby="t-chamados-g">
            <h3 id="t-chamados-g">Chamados pendentes</h3>
            {d.chamadosPendentes.length === 0 ? (
              <p className="vazio">Nenhum chamado pendente</p>
            ) : (
              <ul className="lista-estoque">
                {d.chamadosPendentes.map((c) => (
                  <li key={c.id}>{`Mesa ${c.mesa}, há ${minutosDesde(c.criadoEm)} min`}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
