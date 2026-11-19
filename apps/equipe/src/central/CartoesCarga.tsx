import type { CentralResposta, FaixaCarga } from '../api/tipos'
import { navegar } from '../rotas'
import '../estilo/central.css'

const FAIXA: Record<FaixaCarga, string> = {
  TRANQUILO: 'tranquilo',
  CHEIO: 'cheio',
  SOBRECARREGADO: 'sobrecarregado',
}

type Props = {
  garcons: CentralResposta['cargaGarcons']
  estacoes: CentralResposta['cargaEstacoes']
  grupo: CentralResposta['grupo']
}

/** Carga da equipe: sem ranking, na ordem recebida; barra neutra proporcional. */
export default function CartoesCarga({ garcons, estacoes, grupo }: Props) {
  const escala = Math.max(8, ...garcons.map((g) => g.carga))
  return (
    <section className="bloco-central" aria-labelledby="t-carga">
      <h2 id="t-carga">Carga da equipe</h2>
      <p className="central-resumo">
        {grupo.garconsEmTurno === 0
          ? 'Nenhum garçom em turno'
          : `${grupo.garconsEmTurno} ${grupo.garconsEmTurno === 1 ? 'garçom em turno' : 'garçons em turno'} · carga média ${(grupo.cargaMedia ?? 0).toLocaleString('pt-BR')}`}
      </p>
      {garcons.length > 0 && (
        <ul className="cartoes-carga">
          {garcons.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="carga-cartao"
                onClick={() => navegar(`/central/garcom/${encodeURIComponent(g.id)}`)}
              >
                <span className="carga-nome">{g.nome}</span>
                <span className="carga-sub">{`${g.mesasAbertas} mesas · ${g.chamadosPendentes} chamados`}</span>
                <span className="carga-trilho" aria-hidden="true">
                  <span className="carga-cheio" style={{ width: `${Math.min(100, (100 * g.carga) / escala)}%` }} />
                </span>
                <span className="carga-faixa">{FAIXA[g.faixa]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>Cozinha e bar</h3>
      {estacoes.length === 0 ? (
        <p className="vazio">Nenhuma estação com pedidos</p>
      ) : (
        <ul className="cartoes-carga">
          {estacoes.map((e) => (
            <li key={e.estacao} className="carga-cartao carga-cartao--fixo">
              <span className="carga-nome">{e.estacao}</span>
              <span className="carga-sub">{`${e.naFila} na fila · ${e.emPreparo} em preparo`}</span>
              {e.maisAntigoMin !== null && <span className="carga-sub">{`mais antigo: ${e.maisAntigoMin} min`}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
