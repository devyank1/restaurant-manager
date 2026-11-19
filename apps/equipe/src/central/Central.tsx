import { formatarReais } from '@cardapio/opcoes'
import { useEffect, useState } from 'react'
import { buscarCentral } from '../api/paineis'
import type { CentralResposta } from '../api/tipos'
import { mensagemDe } from '../estoque/textos'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import CartoesCarga from './CartoesCarga'
import LinhaPorHora from './LinhaPorHora'
import ListaAlertas from './ListaAlertas'
import '../estilo/paineis.css'
import '../estilo/central.css'

const hora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/** Início do dono: o que pede atenção agora, carga da equipe e contexto do dia. */
export default function Central() {
  const [dados, setDados] = useState<CentralResposta | null>(null)
  const [erro, setErro] = useState('')

  const recarregar = useMaisRecente(
    buscarCentral,
    (c) => {
      setDados(c)
      setErro('')
    },
    (e) => setErro(mensagemDe(e)),
  )
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  useEquipeAoVivo({ central: recarregar })

  return (
    <main className="central">
      {erro && (
        <p className="central-erro" role="alert">
          {erro}
        </p>
      )}
      {dados === null && !erro && <p className="carregando">Carregando…</p>}
      {dados && (
        <>
          <header className="central-topo">
            <h1>Agora</h1>
            <span className="central-hora">{`Atualizado às ${hora.format(new Date(dados.verificadoEm))}`}</span>
          </header>

          <ListaAlertas alertas={dados.alertas} agora={dados.verificadoEm} />
          <CartoesCarga garcons={dados.cargaGarcons} estacoes={dados.cargaEstacoes} grupo={dados.grupo} />

          <section className="bloco-central" aria-labelledby="t-contexto">
            <h2 id="t-contexto">Contexto do dia</h2>
            <dl className="numeros-grandes">
              <div>
                <dt>Faturamento</dt>
                <dd>{formatarReais(dados.contexto.faturamentoCentavos)}</dd>
              </div>
              <div>
                <dt>Ticket médio</dt>
                <dd>
                  {dados.contexto.ticketMedioCentavos === null ? '—' : formatarReais(dados.contexto.ticketMedioCentavos)}
                </dd>
              </div>
            </dl>
            <LinhaPorHora pontos={dados.contexto.porHora} />
          </section>
        </>
      )}

      <nav className="central-atalhos" aria-label="Atalhos">
        <button type="button" className="botao botao--primario" onClick={() => navegar('/estoque')}>
          Estoque
        </button>
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/metas')}>
          Metas
        </button>
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/tempos')}>
          Tempo de preparo
        </button>
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/limites')}>
          Limites
        </button>
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/dia')}>
          Detalhes do dia
        </button>
      </nav>
    </main>
  )
}
