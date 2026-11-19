import { useEffect, useRef, useState } from 'react'
import { buscarLimites, salvarLimite } from '../api/paineis'
import type { LimitesAlerta, TipoAlerta } from '../api/tipos'
import { BarraTitulo } from '../estoque/comum'
import { mensagemDe } from '../estoque/textos'
import { lerInteiro } from '../paineis/numeros'
import '../estilo/central.css'
import '../estilo/estoque.css'

const NOMES: [TipoAlerta, string][] = [
  ['MESA_SEM_ATENDIMENTO', 'Mesa sem atendimento'],
  ['CHAMADO_SEM_RESPOSTA', 'Chamado sem resposta'],
  ['CHAMADO_PARA_TODOS', 'Chamado para todos'],
  ['PEDIDO_ATRASADO', 'Pedido atrasado'],
  ['PEDIDO_ESQUECIDO', 'Pedido esquecido'],
  ['FILA_ACUMULADA', 'Fila acumulada'],
  ['GARCOM_CARGA_ALTA', 'Garçom com carga alta'],
  ['GARCOM_SEM_PAUSA', 'Garçom sem pausa'],
  ['ESTOQUE_CRITICO', 'Estoque crítico'],
  ['MOVIMENTO_ALTO', 'Movimento fora do normal'],
  ['SEM_GARCOM', 'Sem garçom em turno'],
]

const VALOR: Partial<Record<TipoAlerta, { min: number; max: number; unidade: string }>> = {
  MESA_SEM_ATENDIMENTO: { min: 1, max: 60, unidade: 'minutos' },
  CHAMADO_SEM_RESPOSTA: { min: 1, max: 30, unidade: 'minutos' },
  FILA_ACUMULADA: { min: 1, max: 50, unidade: 'pedidos' },
  MOVIMENTO_ALTO: { min: 110, max: 300, unidade: '% da média' },
}

type Avisar = (ok: string, erro?: string) => void

function Linha({
  tipo,
  nome,
  config,
  onMudou,
  avisar,
}: {
  tipo: TipoAlerta
  nome: string
  config: LimitesAlerta[TipoAlerta]
  onMudou: (c: LimitesAlerta[TipoAlerta]) => void
  avisar: Avisar
}) {
  const regra = VALOR[tipo]
  const atual = useRef(config)
  useEffect(() => {
    atual.current = config
  }, [config])
  const [texto, setTexto] = useState(config.valor === null ? '' : String(config.valor))

  const gravar = async (novo: LimitesAlerta[TipoAlerta]) => {
    const antes = config
    onMudou(novo)
    try {
      await salvarLimite(tipo, novo)
      avisar('Salvo')
    } catch (e) {
      // Só desfaz se nenhuma mudança mais nova entrou depois desta.
      if (atual.current === novo) onMudou(antes)
      avisar('', mensagemDe(e))
    }
  }

  const salvarValor = () => {
    if (!regra) return
    const n = lerInteiro(texto, regra.min, regra.max)
    if (n === null) return avisar('', `${nome}: use de ${regra.min} a ${regra.max} ${regra.unidade}`)
    void gravar({ ativo: config.ativo, valor: n })
  }

  return (
    <li className="editor-meta">
      <label className="interruptor-linha">
        <input
          type="checkbox"
          role="switch"
          checked={config.ativo}
          onChange={(e) => void gravar({ ativo: e.target.checked, valor: config.valor })}
        />
        {`${nome} ativado`}
      </label>
      <p className="linha-estoque-sub">{config.ativo ? 'Ligado' : 'Desligado'}</p>
      {regra && (
        <>
          <label className="campo-quantidade">
            {`${nome} (${regra.unidade})`}
            <input inputMode="numeric" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <button type="button" className="botao botao--primario" onClick={salvarValor}>
            {`Salvar ${nome}`}
          </button>
        </>
      )}
    </li>
  )
}

/** Quais alertas ficam ligados e a partir de quando avisar. */
export default function TelaLimites() {
  const [limites, setLimites] = useState<LimitesAlerta | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    buscarLimites()
      .then(setLimites)
      .catch((e: unknown) => setErro(mensagemDe(e)))
  }, [])

  const avisar: Avisar = (ok, falha = '') => {
    setAviso(ok)
    setErro(falha)
  }

  return (
    <main className="tela-estoque">
      <BarraTitulo titulo="Limites dos alertas" />
      {erro && (
        <p className="central-erro" role="alert">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="aviso" role="status">
          {aviso}
        </p>
      )}
      {limites === null && !erro && <p className="carregando">Carregando…</p>}
      {limites && (
        <ul className="lista-estoque">
          {NOMES.map(([tipo, nome]) => (
            <Linha
              key={tipo}
              tipo={tipo}
              nome={nome}
              config={limites[tipo]}
              onMudou={(c) => setLimites((l) => (l ? { ...l, [tipo]: c } : l))}
              avisar={avisar}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
