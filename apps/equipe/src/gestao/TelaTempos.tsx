import { useEffect, useState } from 'react'
import { buscarTempos, mudarTempoCategoria, mudarTempoPrato } from '../api/paineis'
import type { TemposCardapio } from '../api/tipos'
import { BarraTitulo } from '../estoque/comum'
import { mensagemDe } from '../estoque/textos'
import '../estilo/estoque.css'

/** Texto do campo → minutos; vazio = null (usa o padrão); inválido = undefined. */
function lerMinutos(texto: string): number | null | undefined {
  const t = texto.trim()
  if (t === '') return null
  if (!/^\d+$/.test(t)) return undefined
  const n = Number(t)
  return n >= 1 && n <= 240 ? n : undefined
}

function CampoMinutos({
  rotulo,
  valor,
  placeholder,
  onSalvar,
}: {
  rotulo: string
  valor: number | null
  placeholder?: string
  onSalvar: (min: number | null) => Promise<void>
}) {
  const [texto, setTexto] = useState(valor === null ? '' : String(valor))
  return (
    <label className="campo-quantidade">
      {rotulo}
      <input
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const lido = lerMinutos(texto)
          if (lido === valor) return
          void onSalvar(lido === undefined ? Number.NaN : lido)
        }}
      />
    </label>
  )
}

/** Tempo de preparo: padrão por categoria; cada prato herda ou tem o seu. */
export default function TelaTempos() {
  const [tempos, setTempos] = useState<TemposCardapio | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    buscarTempos()
      .then(setTempos)
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [])

  const salvar = (mudar: (min: number | null) => Promise<object>) => async (min: number | null) => {
    setAviso('')
    if (Number.isNaN(min)) return setErro('Use de 1 a 240 minutos (ou deixe vazio para usar o padrão)')
    setErro('')
    try {
      await mudar(min)
      setAviso('Salvo')
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Tempo de preparo" />
      <p className="linha-estoque-sub">
        Quanto cada prato leva para ficar pronto. A produção fica amarela depois do tempo + 10% e vermelha no dobro.
        Prato sem tempo usa o padrão da categoria (ou 15 min).
      </p>
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
      {tempos === null && !erro && <p className="carregando">Carregando…</p>}
      {tempos?.categorias.map((c) => (
        <section key={c.id} className="bloco-estoque" aria-label={`${c.nome} · ${c.estacao}`}>
          <h3>{`${c.nome} · ${c.estacao}`}</h3>
          <CampoMinutos
            rotulo="Padrão da categoria (min)"
            valor={c.tempoPreparoMin}
            placeholder="15"
            onSalvar={salvar(async (min) => {
              await mudarTempoCategoria(c.id, min)
              setTempos((t) => t && { categorias: t.categorias.map((x) => (x.id === c.id ? { ...x, tempoPreparoMin: min } : x)) })
              return {}
            })}
          />
          <ul>
            {c.pratos.map((p) => (
              <li key={p.id}>
                <CampoMinutos
                  rotulo={`Tempo de ${p.nome} (min)`}
                  valor={p.tempoPreparoMin}
                  placeholder={`Padrão: ${c.tempoPreparoMin ?? 15} min`}
                  onSalvar={salvar(async (min) => {
                    await mudarTempoPrato(p.id, min)
                    setTempos(
                      (t) =>
                        t && {
                          categorias: t.categorias.map((x) =>
                            x.id === c.id
                              ? { ...x, pratos: x.pratos.map((y) => (y.id === p.id ? { ...y, tempoPreparoMin: min } : y)) }
                              : x,
                          ),
                        },
                    )
                    return {}
                  })}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
