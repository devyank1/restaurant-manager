import { useEffect, useId, useState } from 'react'
import {
  buscarMetas,
  salvarHorasSemPausa,
  salvarMetaEquipe,
  salvarMetaEstacao,
  salvarMetaPadrao,
} from '../api/paineis'
import type { MetasConfig, MetaValor, PeriodoMeta, TipoPessoa } from '../api/tipos'
import { BarraTitulo } from '../estoque/comum'
import { mensagemDe } from '../estoque/textos'
import { lerInteiro, lerReais, reaisNoCampo } from '../paineis/numeros'
import { navegar } from '../rotas'
import '../estilo/estoque.css'

type Avisar = (ok: string, erro?: string) => void

/** Uma meta (valor vendido ou mesas): quanto, dia/semana, Salvar e Sem meta. */
function EditorMeta({
  rotulo,
  tipo,
  valor,
  onSalvar,
  avisar,
}: {
  rotulo: string
  tipo: TipoPessoa
  valor: MetaValor
  onSalvar: (v: MetaValor) => Promise<unknown>
  avisar: Avisar
}) {
  const [texto, setTexto] = useState(valor ? (tipo === 'VALOR' ? reaisNoCampo(valor.alvo) : String(valor.alvo)) : '')
  const [periodo, setPeriodo] = useState<PeriodoMeta>(valor?.periodo ?? 'DIA')
  const [tem, setTem] = useState(!!valor)
  const id = useId()

  const salvar = async () => {
    const alvo = tipo === 'VALOR' ? lerReais(texto) : lerInteiro(texto, 1, 1_000_000)
    if (alvo === null) return avisar('', tipo === 'VALOR' ? 'Digite um valor maior que zero' : 'Digite quantas mesas (1 ou mais)')
    try {
      await onSalvar({ periodo, alvo })
      setTem(true)
      avisar('Salvo')
    } catch (e) {
      avisar('', mensagemDe(e))
    }
  }

  const apagar = async () => {
    try {
      await onSalvar(null)
      setTexto('')
      setTem(false)
      avisar('Meta removida')
    } catch (e) {
      avisar('', mensagemDe(e))
    }
  }

  return (
    <fieldset className="editor-meta">
      <legend>{rotulo}</legend>
      <label className="campo-quantidade" htmlFor={id}>
        {tipo === 'VALOR' ? `${rotulo} (R$)` : rotulo}
      </label>
      <input id={id} inputMode={tipo === 'VALOR' ? 'decimal' : 'numeric'} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="chips">
        {(['DIA', 'SEMANA'] as const).map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
            {p === 'DIA' ? 'Dia' : 'Semana'}
          </button>
        ))}
      </div>
      <div className="confirmacao-botoes">
        <button type="button" className="botao botao--primario" onClick={() => void salvar()}>
          Salvar
        </button>
        {tem && (
          <button type="button" className="botao botao--secundario" onClick={() => void apagar()}>
            Sem meta
          </button>
        )}
      </div>
    </fieldset>
  )
}

function EditorEstacao({
  estacao,
  noTempoPct,
  zeroEsquecidos,
  avisar,
}: MetasConfig['estacoes'][number] & { avisar: Avisar }) {
  const [pct, setPct] = useState(noTempoPct === null ? '' : String(noTempoPct))
  const [zero, setZero] = useState(zeroEsquecidos)

  const salvar = async () => {
    const lido = pct.trim() === '' ? null : lerInteiro(pct, 1, 100)
    if (lido === null && pct.trim() !== '') return avisar('', 'Use de 1 a 100%')
    try {
      await salvarMetaEstacao(estacao, { noTempoPct: lido, zeroEsquecidos: zero })
      avisar('Salvo')
    } catch (e) {
      avisar('', mensagemDe(e))
    }
  }

  return (
    <fieldset className="editor-meta">
      <legend>{estacao}</legend>
      <label className="campo-quantidade">
        {`% no tempo (${estacao})`}
        <input inputMode="numeric" value={pct} placeholder="Sem meta" onChange={(e) => setPct(e.target.value)} />
      </label>
      <label className="interruptor-linha">
        <input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} />
        {`Zero esquecidos (${estacao})`}
      </label>
      <button type="button" className="botao botao--primario" onClick={() => void salvar()}>
        Salvar
      </button>
    </fieldset>
  )
}

function EditorPausa({ horas, avisar }: { horas: number; avisar: Avisar }) {
  const [texto, setTexto] = useState(String(horas))
  const salvar = async () => {
    const h = lerInteiro(texto, 1, 12)
    if (h === null) return avisar('', 'Use de 1 a 12 horas')
    try {
      await salvarHorasSemPausa(h)
      avisar('Salvo')
    } catch (e) {
      avisar('', mensagemDe(e))
    }
  }
  return (
    <>
      <label className="campo-quantidade">
        Avisar depois de quantas horas sem pausa
        <input inputMode="numeric" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <button type="button" className="botao botao--primario" onClick={() => void salvar()}>
        Salvar
      </button>
    </>
  )
}

/** Metas da equipe, padrão dos garçons, ajuste por pessoa, estações e pausa. */
export default function TelaMetas() {
  const [metas, setMetas] = useState<MetasConfig | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    buscarMetas()
      .then(setMetas)
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [])

  const avisar: Avisar = (ok, falha = '') => {
    setAviso(ok)
    setErro(falha)
  }

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Metas" />
      <p className="linha-estoque-sub">Abaixo da meta a barra fica neutra; quando bate, fica verde e a equipe comemora.</p>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="aviso" role="status">
          {aviso}
        </p>
      )}
      {metas === null && !erro && <p className="carregando">Carregando…</p>}
      {metas && (
        <>
          <section className="bloco-estoque" aria-labelledby="t-meta-equipe">
            <h3 id="t-meta-equipe">Meta da equipe</h3>
            <EditorMeta
              rotulo="Valor vendido pela equipe"
              tipo="VALOR"
              valor={metas.equipe.VALOR}
              onSalvar={(v) => salvarMetaEquipe('VALOR', v)}
              avisar={avisar}
            />
            <EditorMeta
              rotulo="Mesas atendidas pela equipe"
              tipo="MESAS"
              valor={metas.equipe.MESAS}
              onSalvar={(v) => salvarMetaEquipe('MESAS', v)}
              avisar={avisar}
            />
          </section>

          <section className="bloco-estoque" aria-labelledby="t-meta-padrao">
            <h3 id="t-meta-padrao">Meta de cada garçom (padrão)</h3>
            <p className="linha-estoque-sub">Vale para todos os garçons, todo dia ou toda semana, até você mudar.</p>
            <EditorMeta
              rotulo="Valor vendido por garçom"
              tipo="VALOR"
              valor={metas.garcomPadrao.VALOR}
              onSalvar={(v) => salvarMetaPadrao('VALOR', v)}
              avisar={avisar}
            />
            <EditorMeta
              rotulo="Mesas atendidas por garçom"
              tipo="MESAS"
              valor={metas.garcomPadrao.MESAS}
              onSalvar={(v) => salvarMetaPadrao('MESAS', v)}
              avisar={avisar}
            />
          </section>

          <section className="bloco-estoque" aria-labelledby="t-ajustar">
            <h3 id="t-ajustar">Ajustar para alguém</h3>
            <p className="linha-estoque-sub">Por exemplo, para quem trabalha meio período.</p>
            {metas.garcons.length === 0 ? (
              <p className="vazio">Nenhum garçom cadastrado.</p>
            ) : (
              <ul className="lista-estoque">
                {metas.garcons.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="linha-estoque--botao"
                      onClick={() => navegar(`/metas/garcom/${encodeURIComponent(g.id)}`)}
                    >
                      {g.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bloco-estoque" aria-labelledby="t-estacoes">
            <h3 id="t-estacoes">Cozinha e bar</h3>
            <p className="linha-estoque-sub">Metas de cada estação, por noite. Nunca de uma pessoa.</p>
            {metas.estacoes.map((e) => (
              <EditorEstacao key={e.estacao} {...e} avisar={avisar} />
            ))}
          </section>

          <section className="bloco-estoque" aria-labelledby="t-cuidado">
            <h3 id="t-cuidado">Cuidado com a equipe</h3>
            <EditorPausa horas={metas.horasSemPausa} avisar={avisar} />
          </section>
        </>
      )}
    </main>
  )
}
