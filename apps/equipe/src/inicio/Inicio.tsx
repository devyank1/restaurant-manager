import { useCallback, useEffect, useState } from 'react'
import { buscarChamados, buscarMesas } from '../api/equipe'
import type { ChamadoEquipe, MesaResumo, UsuarioEquipe } from '../api/tipos'
import { lerEtiqueta, suportaNfc } from '../nfc/lerEtiqueta'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import ListaChamados from './ListaChamados'

export default function Inicio({ usuario }: { usuario: UsuarioEquipe }) {
  const [chamados, setChamados] = useState<ChamadoEquipe[] | null>(null)
  const [mesas, setMesas] = useState<MesaResumo[]>([])
  const [lendo, setLendo] = useState(false)
  const [erroNfc, setErroNfc] = useState('')

  // Falha de rede: mantém o que já tinha; a reconexão busca de novo.
  const recarregarChamados = useCallback(() => {
    buscarChamados().then(setChamados, () => undefined)
  }, [])
  const recarregarMesas = useCallback(() => {
    buscarMesas().then(setMesas, () => undefined)
  }, [])

  useEffect(() => {
    recarregarChamados()
    recarregarMesas()
  }, [recarregarChamados, recarregarMesas])

  useEquipeAoVivo({ chamados: recarregarChamados, mesas: recarregarMesas })

  // O dono vê as mesas de todos; o garçom, as que são dele.
  const minhas = mesas.filter((m) => m.aberta && (usuario.papel === 'DONO' || m.garcomNome === usuario.nome))

  const ler = async () => {
    setLendo(true)
    setErroNfc('')
    try {
      const token = await lerEtiqueta()
      if (token) navegar(`/mesa/${encodeURIComponent(token)}`)
    } catch (erro) {
      setErroNfc(erro instanceof Error ? erro.message : 'Não consegui ler a etiqueta.')
    } finally {
      setLendo(false)
    }
  }

  return (
    <main className="inicio">
      {!usuario.emTurno && usuario.papel !== 'DONO' && (
        <p className="faixa-aviso">Você está fora do turno: não recebe chamados novos.</p>
      )}

      <section aria-labelledby="titulo-chamados">
        <h2 id="titulo-chamados">Chamados</h2>
        {chamados === null ? (
          <p className="vazio">Carregando…</p>
        ) : (
          <ListaChamados chamados={chamados} onMudou={recarregarChamados} />
        )}
      </section>

      <section aria-labelledby="titulo-minhas">
        <h2 id="titulo-minhas">Minhas mesas</h2>
        {minhas.length === 0 ? (
          <p className="vazio">Nenhuma mesa com você.</p>
        ) : (
          <ul className="mesas">
            {minhas.map((m) => (
              <li key={m.token}>
                <button type="button" className="mesa-cartao" onClick={() => navegar(`/mesa/${encodeURIComponent(m.token)}`)}>
                  <span className="mesa-numero">{`Mesa ${m.numero}`}</span>
                  {m.pendentes > 0 && <span className="selo selo--alerta">{`${m.pendentes} aguardando`}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="inicio-acoes">
        {suportaNfc() && (
          <button type="button" className="botao botao--secundario" disabled={lendo} onClick={ler}>
            {lendo ? 'Encoste na etiqueta…' : '📡 Ler etiqueta'}
          </button>
        )}
        <button type="button" className="botao botao--secundario" onClick={() => navegar('/mesas')}>
          Todas as mesas
        </button>
      </div>
      {erroNfc && (
        <p className="erro" role="alert">
          {erroNfc}
        </p>
      )}
    </main>
  )
}
