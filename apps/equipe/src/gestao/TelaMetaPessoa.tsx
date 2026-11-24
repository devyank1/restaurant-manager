import { useEffect, useId, useState } from 'react'
import { buscarMetaPessoa, salvarAjuste } from '../api/paineis'
import type { MetaPessoa, TipoPessoa } from '../api/tipos'
import { BarraTitulo } from '../estoque/comum'
import { mensagemDe } from '../estoque/textos'
import { lerInteiro, lerReais, reaisNoCampo } from '../paineis/numeros'
import { NOME_TIPO, textoMetaValor } from './textos'
import '../estilo/estoque.css'

function Ajuste({
  pessoa,
  tipo,
  avisar,
}: {
  pessoa: MetaPessoa
  tipo: TipoPessoa
  avisar: (ok: string, erro?: string) => void
}) {
  const { padrao, ajuste } = pessoa[tipo]
  const [texto, setTexto] = useState(ajuste === null ? '' : tipo === 'VALOR' ? reaisNoCampo(ajuste) : String(ajuste))
  const [temAjuste, setTemAjuste] = useState(ajuste !== null)
  const id = useId()
  const rotulo = tipo === 'VALOR' ? `Valor vendido de ${pessoa.nome} (R$)` : `Mesas atendidas de ${pessoa.nome}`

  const salvar = async (alvo: number | null) => {
    try {
      await salvarAjuste(pessoa.id, tipo, alvo)
      setTemAjuste(alvo !== null)
      if (alvo === null) setTexto('')
      avisar(alvo === null ? 'Voltou ao padrão' : 'Salvo')
    } catch (e) {
      avisar('', mensagemDe(e))
    }
  }

  return (
    <fieldset className="editor-meta">
      <legend>{NOME_TIPO[tipo]}</legend>
      {padrao ? (
        <>
          <p className="linha-estoque-sub">{`Padrão: ${textoMetaValor(tipo, padrao)}`}</p>
          <label className="campo-quantidade" htmlFor={id}>
            {rotulo}
          </label>
          <input
            id={id}
            inputMode={tipo === 'VALOR' ? 'decimal' : 'numeric'}
            value={texto}
            placeholder="Usa o padrão"
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="confirmacao-botoes">
            <button
              type="button"
              className="botao botao--primario"
              onClick={() => {
                const alvo = tipo === 'VALOR' ? lerReais(texto) : lerInteiro(texto, 1, 1_000_000)
                if (alvo === null) return avisar('', 'Digite um valor maior que zero')
                void salvar(alvo)
              }}
            >
              Salvar
            </button>
            {temAjuste && (
              <button type="button" className="botao botao--secundario" onClick={() => void salvar(null)}>
                Usar o padrão
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="vazio">Sem meta padrão. Defina em Metas primeiro.</p>
      )}
    </fieldset>
  )
}

/** Ajuste da meta de uma pessoa só: sem lista comparando valores [spec §4.2]. */
export default function TelaMetaPessoa({ id }: { id: string }) {
  const [pessoa, setPessoa] = useState<MetaPessoa | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    buscarMetaPessoa(id)
      .then(setPessoa)
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [id])

  const avisar = (ok: string, falha = '') => {
    setAviso(ok)
    setErro(falha)
  }

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo={pessoa ? `Meta de ${pessoa.nome}` : 'Meta'} />
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
      {pessoa === null && !erro && <p className="carregando">Carregando…</p>}
      {pessoa && (
        <>
          <p className="linha-estoque-sub">Deixe vazio para usar o padrão da equipe.</p>
          <Ajuste pessoa={pessoa} tipo="VALOR" avisar={avisar} />
          <Ajuste pessoa={pessoa} tipo="MESAS" avisar={avisar} />
        </>
      )}
    </main>
  )
}
