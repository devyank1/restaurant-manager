import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarApiFalsa, type ApiFalsa } from '../test/api-falsa'
import { carla } from '../test/estoque-fixtures'
import TelaMetaPessoa from './TelaMetaPessoa'

describe('Meta de uma pessoa', () => {
  let api: ApiFalsa

  beforeEach(() => {
    api = criarApiFalsa()
    api.estado.usuario = { ...carla }
    api.estado.paineis.pessoas['u-ana'] = {
      id: 'u-ana',
      nome: 'Ana',
      VALOR: { padrao: { periodo: 'DIA', alvo: 80000 }, ajuste: 40000 },
      MESAS: { padrao: null, ajuste: null },
    }
    vi.stubGlobal('fetch', api.fetch)
  })

  it('mostra o padrão e deixa ajustar só esta pessoa', async () => {
    render(<TelaMetaPessoa id="u-ana" />)
    expect(await screen.findByRole('heading', { name: 'Meta de Ana' })).toBeInTheDocument()
    const valor = screen.getByRole('group', { name: 'Valor vendido' })
    expect(within(valor).getByText('Padrão: R$ 800,00 por dia')).toBeInTheDocument()
    const campo = within(valor).getByLabelText('Valor vendido de Ana (R$)')
    expect(campo).toHaveValue('400')
    await userEvent.clear(campo)
    await userEvent.type(campo, '500')
    await userEvent.click(within(valor).getByRole('button', { name: 'Salvar' }))
    const [, init] = api.chamadas('PUT', /\/metas\/garcom\/pessoa\/u-ana\/VALOR$/)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ alvo: 50000 })
    expect(screen.queryByText(/Bruno/)).not.toBeInTheDocument()
  })

  it('Usar o padrão apaga o ajuste', async () => {
    render(<TelaMetaPessoa id="u-ana" />)
    const valor = await screen.findByRole('group', { name: 'Valor vendido' })
    await userEvent.click(within(valor).getByRole('button', { name: 'Usar o padrão' }))
    expect(api.chamadas('DELETE', /\/metas\/garcom\/pessoa\/u-ana\/VALOR$/)).toHaveLength(1)
    expect(within(valor).getByLabelText('Valor vendido de Ana (R$)')).toHaveValue('')
  })

  it('sem padrão manda definir em Metas', async () => {
    render(<TelaMetaPessoa id="u-ana" />)
    const mesas = await screen.findByRole('group', { name: 'Mesas atendidas' })
    expect(within(mesas).getByText('Sem meta padrão. Defina em Metas primeiro.')).toBeInTheDocument()
    expect(within(mesas).queryByRole('textbox')).not.toBeInTheDocument()
  })
})
