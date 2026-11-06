import { useState } from 'react'
import { formatarReais, precoEfetivo, precoUnitario, validarSelecao, type Selecao } from './preco'
import { resumirOpcoes } from './resumo'
import type { GrupoOpcaoPublico, ItemEscolhido, PratoPublico } from './tipos'
import './opcoes.css'

const LIMITE_OBSERVACAO = 140

export default function SeletorOpcoes({
  prato,
  onConfirmar,
  onCancelar,
  inicial,
  rotuloConfirmar = 'Adicionar',
}: {
  prato: PratoPublico
  /** Editar um item existente: começa com as escolhas dele. */
  inicial?: { selecao: Selecao; observacao: string; quantidade: number }
  rotuloConfirmar?: string
  onConfirmar: (item: ItemEscolhido) => void
  onCancelar: () => void
}) {
  const [selecao, setSelecao] = useState<Selecao>(inicial?.selecao ?? {})
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '')
  const [quantidade, setQuantidade] = useState(inicial?.quantidade ?? 1)

  const erros = validarSelecao(prato, selecao)
  const unitario = precoUnitario(prato, selecao)

  const escolherUnica = (grupo: GrupoOpcaoPublico, opcaoId: string) => {
    setSelecao((atual) => ({ ...atual, [grupo.id]: [opcaoId] }))
  }

  const alternarMultipla = (grupo: GrupoOpcaoPublico, opcaoId: string) => {
    setSelecao((atual) => {
      const ids = atual[grupo.id] ?? []
      const novos = ids.includes(opcaoId) ? ids.filter((id) => id !== opcaoId) : [...ids, opcaoId]
      const { [grupo.id]: _removido, ...resto } = atual
      return novos.length > 0 ? { ...resto, [grupo.id]: novos } : resto
    })
  }

  const confirmar = () => {
    onConfirmar({
      pratoId: prato.id,
      nome: prato.nome,
      resumoOpcoes: resumirOpcoes(prato, selecao),
      selecao,
      observacao: observacao.trim(),
      quantidade,
      precoUnitarioCentavos: unitario,
    })
  }

  return (
    <div className="sheet-fundo" onClick={onCancelar}>
      <div
        className="sheet seletor"
        role="dialog"
        aria-modal="true"
        aria-label={`Opções de ${prato.nome}`}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2>{prato.nome}</h2>

        {prato.grupos.map((grupo) => {
          const ids = selecao[grupo.id] ?? []
          const unica = grupo.tipo === 'UNICA'
          const cheio = !unica && ids.length >= grupo.max
          return (
            <fieldset key={grupo.id} className="grupo">
              <legend>
                {grupo.nome}
                <span className="grupo-regra">
                  {grupo.obrigatorio ? 'Obrigatório' : 'Opcional'}
                  {grupo.max > 1 && ` · até ${grupo.max}`}
                </span>
              </legend>
              {grupo.opcoes.map((opcao) => {
                const marcado = ids.includes(opcao.id)
                const preco = precoEfetivo(opcao.precoCentavos, opcao.precoPromocionalCentavos)
                return (
                  <label key={opcao.id} className="opcao">
                    <input
                      type={unica ? 'radio' : 'checkbox'}
                      name={grupo.id}
                      checked={marcado}
                      disabled={!marcado && cheio}
                      onChange={() => (unica ? escolherUnica(grupo, opcao.id) : alternarMultipla(grupo, opcao.id))}
                    />
                    <span className="opcao-nome">{opcao.nome}</span>{' '}
                    {preco > 0 && (
                      <span className="opcao-preco">{unica ? formatarReais(preco) : `+ ${formatarReais(preco)}`}</span>
                    )}
                  </label>
                )
              })}
            </fieldset>
          )
        })}

        <label className="observacao">
          <span>Observação</span>
          <textarea
            value={observacao}
            maxLength={LIMITE_OBSERVACAO}
            placeholder="Ex.: sem cebola"
            onChange={(evento) => setObservacao(evento.target.value)}
          />
        </label>

        <div className="quantidade">
          <button
            type="button"
            aria-label="Diminuir quantidade"
            disabled={quantidade <= 1}
            onClick={() => setQuantidade((q) => q - 1)}
          >
            −
          </button>
          <span aria-live="polite">{quantidade}</span>
          <button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantidade((q) => q + 1)}>
            +
          </button>
        </div>

        {erros.length > 0 && (
          <ul className="erros">
            {erros.map((erro) => (
              <li key={erro}>{erro}</li>
            ))}
          </ul>
        )}

        <div className="seletor-acoes">
          <button type="button" className="botao botao--secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="botao botao--primario" disabled={erros.length > 0} onClick={confirmar}>
            {`${rotuloConfirmar} · ${formatarReais(unitario * quantidade)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
