import { useEffect, useState } from 'react'
import { buscarResumo } from '../api/estoque'
import { buscarChamados, buscarMesas } from '../api/equipe'
import type { ChamadoEquipe, MesaResumo, UsuarioEquipe } from '../api/tipos'
import { lerEtiqueta, suportaNfc } from '../nfc/lerEtiqueta'
import { ativarNotificacoes, estadoNotificacoes, type EstadoPush } from '../push/ativarNotificacoes'
import { navegar } from '../rotas'
import { useEquipeAoVivo } from '../tempo-real/useEquipeAoVivo'
import { useMaisRecente } from '../tempo-real/useMaisRecente'
import ListaChamados from './ListaChamados'

export default function Inicio({ usuario }: { usuario: UsuarioEquipe }) {
  const [chamados, setChamados] = useState<ChamadoEquipe[] | null>(null)
  const [mesas, setMesas] = useState<MesaResumo[]>([])
  const [lendo, setLendo] = useState(false)
  const [erroNfc, setErroNfc] = useState('')
  const [push, setPush] = useState<EstadoPush>(estadoNotificacoes)
  const [avisoPush, setAvisoPush] = useState('')

  // O dono não cuida do salão: não vê chamados nem mesas.
  const dono = usuario.papel === 'DONO'
  // Falha de rede: mantém o que já tinha; a reconexão busca de novo.
  const recarregarChamados = useMaisRecente(() => (dono ? Promise.resolve([]) : buscarChamados()), setChamados)
  const recarregarMesas = useMaisRecente(() => (dono ? Promise.resolve([]) : buscarMesas()), setMesas)

  useEffect(() => {
    void recarregarChamados()
    void recarregarMesas()
  }, [recarregarChamados, recarregarMesas])

  // Gerente: quantos itens do estoque pedem atenção (acabando + acabou).
  const [atencao, setAtencao] = useState(0)
  const recarregarEstoque = useMaisRecente(
    () => (dono ? buscarResumo() : Promise.resolve(null)),
    (r) => setAtencao(r ? r.acabando.length + r.acabou.length : 0),
  )
  useEffect(() => {
    void recarregarEstoque()
  }, [recarregarEstoque])

  useEquipeAoVivo({ chamados: recarregarChamados, mesas: recarregarMesas, estoque: recarregarEstoque })

  // Permissão já dada: reenvia a inscrição (celular trocado, cookie novo, chave nova).
  useEffect(() => {
    if (estadoNotificacoes() === 'ativado') ativarNotificacoes().catch(() => undefined)
  }, [])

  const ligarPush = async () => {
    setAvisoPush('')
    try {
      const resultado = await ativarNotificacoes()
      if (resultado === 'sem-chave') setAvisoPush('Notificações desligadas no servidor (falta configurar VAPID).')
      setPush(estadoNotificacoes())
    } catch {
      setAvisoPush('Não consegui ativar as notificações. Tente de novo.')
    }
  }

  const minhas = mesas.filter((m) => m.aberta && m.garcomNome === usuario.nome)

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
        <p className="faixa-aviso faixa-aviso--alerta">Você está fora do turno: não recebe chamados novos.</p>
      )}

      {push === 'pendente' && (
        <button type="button" className="botao botao--primario faixa-push" onClick={ligarPush}>
          Ativar notificações
        </button>
      )}
      {push === 'negado' && (
        <p className="faixa-aviso faixa-aviso--perigo">Notificações bloqueadas no navegador</p>
      )}
      {push === 'sem-suporte' && (
        <p className="faixa-aviso faixa-aviso--info">
          Notificações indisponíveis neste navegador: abra pelo endereço HTTPS e, no iPhone, adicione à Tela de Início.
        </p>
      )}
      {avisoPush && <p className="faixa-aviso faixa-aviso--perigo">{avisoPush}</p>}

      {!dono && (
      <>
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
                  <span className="mesa-selos">
                    {m.prontos > 0 && (
                      <span className="selo selo--sucesso">{`${m.prontos} ${m.prontos === 1 ? 'pronto' : 'prontos'}`}</span>
                    )}
                    {m.pendentes > 0 && <span className="selo selo--alerta">{`${m.pendentes} aguardando`}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}

      <div className="inicio-acoes">
        {!dono && suportaNfc() && (
          <button type="button" className="botao botao--secundario" disabled={lendo} onClick={ler}>
            {lendo ? 'Encoste na etiqueta…' : '📡 Ler etiqueta'}
          </button>
        )}
        {!dono && (
          <button type="button" className="botao botao--secundario" onClick={() => navegar('/mesas')}>
            Todas as mesas
          </button>
        )}
        {dono && (
          <button type="button" className="botao botao--primario" onClick={() => navegar('/estoque')}>
            {atencao > 0 ? `Estoque · ${atencao} acabando` : 'Estoque'}
          </button>
        )}
      </div>
      {erroNfc && (
        <p className="erro" role="alert">
          {erroNfc}
        </p>
      )}
    </main>
  )
}
