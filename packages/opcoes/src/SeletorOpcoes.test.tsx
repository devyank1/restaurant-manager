import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { pizza } from './test/fixtures'
import { formatarReais } from './preco'
import SeletorOpcoes from './SeletorOpcoes'

// toHaveAccessibleName compara o nome sem normalizar o espaço sem quebra do R$.
const botaoAdicionar = () => screen.getByRole('button', { name: /^Adicionar/ })

function renderizar() {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  render(<SeletorOpcoes prato={pizza} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
  return { onConfirmar, onCancelar }
}

describe('SeletorOpcoes', () => {
  it('começa bloqueado mostrando o que falta escolher', () => {
    renderizar()
    expect(botaoAdicionar()).toBeDisabled()
    expect(screen.getByText('Escolha Tamanho')).toBeInTheDocument()
  })

  it('libera com tamanho e sabor escolhidos e mostra o preço', async () => {
    renderizar()
    await userEvent.click(screen.getByRole('radio', { name: /^M\b/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^Margherita/ }))
    expect(botaoAdicionar()).toBeEnabled()
    expect(botaoAdicionar()).toHaveAccessibleName(`Adicionar · ${formatarReais(6990)}`)
  })

  it('meio a meio cobra o sabor mais caro e trava o terceiro sabor', async () => {
    renderizar()
    await userEvent.click(screen.getByRole('radio', { name: /^M\b/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^Margherita/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^Quatro Queijos/ }))
    expect(botaoAdicionar()).toHaveAccessibleName(`Adicionar · ${formatarReais(7990)}`)
    expect(screen.getByRole('checkbox', { name: /^Calabresa/ })).toBeDisabled()
  })

  it('observação aceita no máximo 140 caracteres', () => {
    renderizar()
    expect(screen.getByRole('textbox', { name: /Observação/ })).toHaveAttribute('maxLength', '140')
  })

  it('quantidade multiplica o preço e confirma o item completo', async () => {
    const { onConfirmar } = renderizar()
    await userEvent.click(screen.getByRole('radio', { name: /^M\b/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^Margherita/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^Quatro Queijos/ }))
    await userEvent.type(screen.getByRole('textbox', { name: /Observação/ }), 'sem cebola')
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(botaoAdicionar()).toHaveAccessibleName(`Adicionar · ${formatarReais(15980)}`)

    await userEvent.click(botaoAdicionar())
    expect(onConfirmar).toHaveBeenCalledWith({
      pratoId: 'pizza',
      nome: 'Pizza Margherita',
      resumoOpcoes: 'M · Margherita / Quatro Queijos',
      selecao: { tam: ['m'], sab: ['margherita', 'quatroQueijos'] },
      observacao: 'sem cebola',
      quantidade: 2,
      precoUnitarioCentavos: 7990,
    })
  })

  it('cancelar fecha sem adicionar', async () => {
    const { onCancelar, onConfirmar } = renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalled()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('abre com a seleção inicial marcada', () => {
    render(
      <SeletorOpcoes
        prato={pizza}
        inicial={{ selecao: { tam: ['g'], sab: ['margherita'], adic: ['bacon'] }, observacao: 'sem cebola', quantidade: 2 }}
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: /^G/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Bacon/ })).toBeChecked()
    expect(screen.getByRole('textbox')).toHaveValue('sem cebola')
    // (8990 + 800) × 2
    expect(botaoAdicionar()).toHaveTextContent(formatarReais(19580).replace(String.fromCharCode(0xa0), ' '))
  })

  it('rotuloConfirmar troca o texto do botão', () => {
    render(
      <SeletorOpcoes
        prato={pizza}
        inicial={{ selecao: { tam: ['g'], sab: ['margherita'] }, observacao: '', quantidade: 1 }}
        rotuloConfirmar="Salvar"
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /^Salvar/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Adicionar/ })).not.toBeInTheDocument()
  })
})
