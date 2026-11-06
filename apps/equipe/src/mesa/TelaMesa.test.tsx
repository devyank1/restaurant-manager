import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { cardapioDemo, chamado, mesa7 } from '../test/fixtures'
import { reais } from '../test/reais'
import { ultimoSocket } from '../test/socket-falso'
import TelaMesa from './TelaMesa'

describe('Tela da mesa', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...ana, emTurno: true }
    api.estado.mesa = { tok7: mesa7() }
    api.estado.cardapio = cardapioDemo
    vi.stubGlobal('fetch', api.fetch)
  })

  const pendente = () => screen.getByRole('region', { name: 'Pedido aguardando' })

  it('mostra a rodada pendente com observação e selo Celular novo', async () => {
    render(<TelaMesa token="tok7" />)
    expect(await screen.findByRole('heading', { name: 'Mesa 7' })).toBeInTheDocument()
    expect(within(pendente()).getByText('Pizza Margherita')).toBeInTheDocument()
    expect(within(pendente()).getByText('M · Margherita · Bacon')).toBeInTheDocument()
    expect(within(pendente()).getByText('sem cebola')).toBeInTheDocument()
    expect(within(pendente()).getByText('Celular novo')).toBeInTheDocument()
    expect(screen.getByText('Chopp 500ml')).toBeInTheDocument()
    expect(screen.getByText(reais(2380), { selector: '.total-parcial strong' })).toBeInTheDocument()
  })

  it('menos até zero remove o item', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    await userEvent.click(within(pendente()).getByRole('button', { name: 'Diminuir Pizza Margherita' }))
    const [, init] = api.chamadas('PATCH', /\/rodadas\/r1\/itens\/i1$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ quantidade: 0 })
    expect(await within(pendente()).findByText('Nenhum item. Recuse ou adicione um prato.')).toBeInTheDocument()
  })

  it('Confirmar pedido chama a API e a rodada vai para confirmadas', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(api.chamadas('POST', /\/rodadas\/r1\/confirmar$/)).toHaveLength(1)
    expect(await screen.findByText(reais(2380 + 7790), { selector: '.total-parcial strong' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pedido aguardando' })).not.toBeInTheDocument()
  })

  it('Recusar pede confirmação', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    await userEvent.click(screen.getByRole('button', { name: 'Recusar' }))
    expect(screen.getByText('Recusar este pedido?')).toBeInTheDocument()
    expect(api.chamadas('POST', /\/recusar$/)).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }))
    expect(api.chamadas('POST', /\/rodadas\/r1\/recusar$/)).toHaveLength(1)
  })

  it('409 recarrega a mesa e avisa sem erro feio', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    // Bruno confirmou antes.
    api.estado.mesa.tok7.rodadas[1].status = 'CONFIRMADA'
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByText('Este pedido já foi confirmado ou recusado')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pedido aguardando' })).not.toBeInTheDocument()
  })

  it('AdicionarItem lista a pizza e abre as opções; não lista o pastel esgotado', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar prato' }))
    const lista = screen.getByRole('dialog', { name: 'Adicionar prato' })
    expect(within(lista).queryByText('Pastel de Carne Seca')).not.toBeInTheDocument()
    await userEvent.click(within(lista).getByRole('button', { name: /Pizza Margherita/ }))
    const seletor = screen.getByRole('dialog', { name: 'Opções de Pizza Margherita' })
    await userEvent.click(within(seletor).getByRole('radio', { name: /^P/ }))
    await userEvent.click(within(seletor).getByRole('checkbox', { name: /Margherita/ }))
    await userEvent.click(within(seletor).getByRole('button', { name: /^Adicionar/ }))
    const [, init] = api.chamadas('POST', /\/rodadas\/r1\/itens$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      pratoId: 'pizza',
      selecao: { tam: ['p'], sab: ['margherita'] },
      observacao: '',
      quantidade: 1,
    })
    expect(await within(pendente()).findByText('P · Margherita')).toBeInTheDocument()
  })

  it('Editar troca o tamanho da pizza, mantém adicional e observação, e o total muda', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    await userEvent.click(within(pendente()).getByRole('button', { name: 'Editar Pizza Margherita' }))
    const seletor = screen.getByRole('dialog', { name: 'Opções de Pizza Margherita' })
    await userEvent.click(within(seletor).getByRole('radio', { name: /^G/ }))
    await userEvent.click(within(seletor).getByRole('button', { name: /^Salvar/ }))
    const [, init] = api.chamadas('PATCH', /\/rodadas\/r1\/itens\/i1$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      selecao: { tam: ['g'], sab: ['margherita'], adic: ['bacon'] },
      observacao: 'sem cebola',
      quantidade: 1,
    })
    expect(await within(pendente()).findByText('G · Margherita · Bacon')).toBeInTheDocument()
    expect(within(pendente()).getByText(reais(8990 + 800), { selector: '.rodada-total strong' })).toBeInTheDocument()
  })

  it('evento mesa-mudou recarrega', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    api.estado.mesa.tok7.rodadas[1].status = 'CANCELADA'
    act(() => ultimoSocket().servidor('mesa-mudou'))
    expect(await screen.findByText('Recusado')).toBeInTheDocument()
  })

  it("mesa sem sessão mostra 'Mesa livre'", async () => {
    api.estado.mesa.tok7 = { ...mesa7(), garcomNome: null, rodadas: [], totalConfirmadoCentavos: 0 }
    render(<TelaMesa token="tok7" />)
    expect(await screen.findByText('Mesa livre')).toBeInTheDocument()
  })

  it('abrir a mesa (ex.: pela notificação) marca lidos os chamados abertos dela', async () => {
    api.estado.chamados = [
      chamado({ id: 'c1', tipo: 'CONFIRMAR_RODADA' }),
      chamado({ id: 'c2', mesa: { numero: 8, token: 'tok8' } }),
      chamado({ id: 'c3', status: 'LIDO' }),
    ]
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    await waitFor(() => expect(api.chamadas('POST', /\/chamados\/c1\/lido$/)).toHaveLength(1))
    expect(api.chamadas('POST', /\/chamados\/c2\/lido$/)).toHaveLength(0)
    expect(api.chamadas('POST', /\/chamados\/c3\/lido$/)).toHaveLength(0)
  })

  it('chamado novo da mesa aberta na tela também é marcado lido', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    api.estado.chamados = [chamado({ id: 'c5' })]
    act(() => ultimoSocket().servidor('chamados-mudaram'))
    await waitFor(() => expect(api.chamadas('POST', /\/chamados\/c5\/lido$/)).toHaveLength(1))
  })

  it('cardápio que falhou é buscado de novo na próxima atualização', async () => {
    api.uma('GET', /\/cardapio$/, () => ({ status: 500 }))
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    expect(screen.getByRole('button', { name: '+ Adicionar prato' })).toBeDisabled()
    act(() => ultimoSocket().servidor('mesa-mudou'))
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Adicionar prato' })).toBeEnabled())
  })

  it('resposta antiga da mesa não sobrescreve a nova', async () => {
    render(<TelaMesa token="tok7" />)
    await screen.findByRole('heading', { name: 'Mesa 7' })
    const velha = mesa7()
    let soltarAntiga: (r: { status: number; corpo: unknown }) => void = () => {}
    api.uma('GET', /\/api\/equipe\/mesas\/tok7$/, () => new Promise((ok) => (soltarAntiga = ok)))
    api.estado.mesa.tok7.rodadas[1].status = 'CANCELADA'
    act(() => ultimoSocket().servidor('mesa-mudou'))
    act(() => ultimoSocket().servidor('mesa-mudou'))
    expect(await screen.findByText('Recusado')).toBeInTheDocument()
    await act(async () => soltarAntiga({ status: 200, corpo: velha }))
    expect(screen.getByText('Recusado')).toBeInTheDocument()
  })

  it('mesa que não existe avisa', async () => {
    render(<TelaMesa token="nao-existe" />)
    expect(await screen.findByText('Mesa não encontrada')).toBeInTheDocument()
  })
})
