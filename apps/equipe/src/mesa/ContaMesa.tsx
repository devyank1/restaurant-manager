import { calcularConta, formatarReais } from '@cardapio/opcoes'
import { useState } from 'react'
import { fecharConta } from '../api/equipe'
import type { FormaPagamento, MesaEquipe } from '../api/tipos'
import { navegar } from '../rotas'

const FORMAS: { valor: FormaPagamento; nome: string }[] = [
  { valor: 'CARTAO', nome: 'Cartão' },
  { valor: 'PIX', nome: 'Pix' },
  { valor: 'DINHEIRO', nome: 'Dinheiro' },
]
const MAX_PESSOAS = 99

/** Conta da mesa: 10%, couvert por pessoa, forma de pagamento e baixa. */
export default function ContaMesa({
  mesa,
  ocupado,
  agir,
  onVoltar,
}: {
  mesa: MesaEquipe
  ocupado: boolean
  agir: (acao: () => Promise<unknown>) => void
  onVoltar: () => void
}) {
  const { servico: cfgServico, couvert: cfgCouvert } = mesa.conta
  const [servico, setServico] = useState(cfgServico.habilitado && cfgServico.padrao)
  const [couvert, setCouvert] = useState(cfgCouvert.habilitado && cfgCouvert.padrao)
  const [pessoas, setPessoas] = useState(1)
  const [forma, setForma] = useState<FormaPagamento | null>(null)

  const conta = calcularConta({
    subtotalCentavos: mesa.totalConfirmadoCentavos,
    servico,
    couvert,
    pessoas,
    couvertUnitarioCentavos: cfgCouvert.valorCentavos,
  })
  const pendente = mesa.rodadas.some((r) => r.status === 'AGUARDANDO_GARCOM')

  const fechar = () => {
    if (!forma) return
    agir(async () => {
      await fecharConta(mesa.mesa.token, {
        servico,
        couvert,
        ...(couvert ? { pessoas } : {}),
        formaPagamento: forma,
        totalCentavos: conta.totalCentavos,
      })
      navegar('/')
    })
  }

  return (
    <section className="conta" aria-label="Conta da mesa">
      <button type="button" className="voltar" onClick={onVoltar} aria-label="Voltar à mesa">
        ‹ Mesa
      </button>

      <div className="conta-linha">
        <span>Itens</span>
        <strong>{formatarReais(conta.subtotalCentavos)}</strong>
      </div>

      {cfgServico.habilitado && (
        <div className="conta-linha">
          <label className="conta-opcao">
            <input type="checkbox" checked={servico} onChange={(e) => setServico(e.target.checked)} />
            <span>Serviço (10%)</span>
          </label>
          <strong>{formatarReais(conta.servicoCentavos)}</strong>
        </div>
      )}

      {cfgCouvert.habilitado && (
        <>
          <div className="conta-linha">
            <label className="conta-opcao">
              <input type="checkbox" checked={couvert} onChange={(e) => setCouvert(e.target.checked)} />
              <span>Couvert</span>
            </label>
            <strong>{formatarReais(conta.couvertCentavos)}</strong>
          </div>
          {couvert && (
            <div className="conta-pessoas">
              <span className="conta-pessoas-texto">{`${pessoas} × ${formatarReais(cfgCouvert.valorCentavos)}`}</span>
              <div className="item-qtd">
                <button
                  type="button"
                  aria-label="Menos uma pessoa"
                  disabled={pessoas <= 1}
                  onClick={() => setPessoas((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <output aria-label="Pessoas">{pessoas}</output>
                <button
                  type="button"
                  aria-label="Mais uma pessoa"
                  disabled={pessoas >= MAX_PESSOAS}
                  onClick={() => setPessoas((n) => Math.min(MAX_PESSOAS, n + 1))}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="conta-linha conta-linha--total">
        <span>Total</span>
        <strong>{formatarReais(conta.totalCentavos)}</strong>
      </div>

      <div className="conta-formas" role="group" aria-label="Forma de pagamento">
        {FORMAS.map((f) => (
          <button
            key={f.valor}
            type="button"
            className={`chip-forma${forma === f.valor ? ' chip-forma--ativo' : ''}`}
            aria-pressed={forma === f.valor}
            onClick={() => setForma(f.valor)}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {pendente && <p className="conta-aviso">Confirme ou recuse os pedidos pendentes antes de fechar</p>}

      <button
        type="button"
        className="botao botao--sucesso"
        disabled={ocupado || !forma || pendente}
        onClick={fechar}
      >
        {`Fechar conta · ${formatarReais(conta.totalCentavos)}`}
      </button>
    </section>
  )
}
