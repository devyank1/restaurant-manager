import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PratoPublico } from '../api/tipos'
import { chopp, mix, pastel, pizza, pudim } from '../test/fixtures'
import StoryViewer from './StoryViewer'

const comVideo = (prato: PratoPublico, slug: string): PratoPublico => ({
  ...prato,
  videoUrl: `/demo/videos/${slug}.mp4`,
  posterUrl: `/demo/videos/${slug}.jpg`,
})

const pratos = [
  comVideo(mix, 'mix'),
  comVideo(pizza, 'pizza'),
  comVideo(chopp, 'chopp'),
  comVideo(pastel, 'pastel'),
  pudim,
]

function renderizar(indiceInicial = 1) {
  const onFechar = vi.fn()
  const onAdicionar = vi.fn()
  render(
    <StoryViewer pratos={pratos} indiceInicial={indiceInicial} onFechar={onFechar} onAdicionar={onAdicionar} />,
  )
  return { onFechar, onAdicionar }
}

const videoPrincipal = () => screen.getByTestId('story-video') as HTMLVideoElement

describe('StoryViewer', () => {
  it('mostra o contador e um segmento por prato', () => {
    renderizar(1)
    expect(screen.getByText('2 de 5')).toBeInTheDocument()
    expect(screen.getAllByTestId('story-segmento')).toHaveLength(5)
  })

  it('setas do teclado avançam e voltam', () => {
    renderizar(1)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByText('3 de 5')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.getByText('2 de 5')).toBeInTheDocument()
  })

  it('deslizar para cima avança', () => {
    renderizar(1)
    const palco = screen.getByTestId('story-palco')
    fireEvent.pointerDown(palco, { clientY: 500 })
    fireEvent.pointerUp(palco, { clientY: 400 })
    expect(screen.getByText('3 de 5')).toBeInTheDocument()
  })

  it('não passa do último prato', () => {
    renderizar(4)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByText('5 de 5')).toBeInTheDocument()
  })

  it('começa mudo e o botão liga o som', async () => {
    renderizar(0)
    expect(videoPrincipal().muted).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Ativar som' }))
    expect(screen.getByRole('button', { name: 'Desativar som' })).toBeInTheDocument()
    expect(videoPrincipal().muted).toBe(false)
  })

  it('voltar fecha o story', async () => {
    const { onFechar } = renderizar(0)
    await userEvent.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(onFechar).toHaveBeenCalled()
  })

  it('adicionar envia o prato atual', async () => {
    const { onAdicionar } = renderizar(0)
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar ao pedido' }))
    expect(onAdicionar).toHaveBeenCalledWith(pratos[0])
  })

  it('prato esgotado não pode ser adicionado', () => {
    renderizar(3)
    expect(screen.getByRole('button', { name: 'Esgotado' })).toBeDisabled()
  })

  it('pré-carrega o vídeo do próximo prato', () => {
    renderizar(0)
    const preCarga = screen.getByTestId('story-pre-carga') as HTMLVideoElement
    expect(preCarga.getAttribute('preload')).toBe('auto')
    expect(preCarga.getAttribute('src')).toBe('/demo/videos/pizza.mp4')
  })

  it('vídeo com erro cai para o poster', () => {
    renderizar(0)
    fireEvent.error(videoPrincipal())
    expect(screen.queryByTestId('story-video')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mix da Casa' })).toHaveAttribute('src', '/demo/videos/mix.jpg')
  })

  it('prato sem vídeo nem poster mostra o fundo', () => {
    renderizar(4)
    expect(screen.queryByTestId('story-video')).not.toBeInTheDocument()
    expect(screen.getByTestId('story-fundo')).toBeInTheDocument()
  })

  it('mostra selo de destaque, nome e preço do prato', () => {
    renderizar(0)
    expect(screen.getByText('DESTAQUE')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mix da Casa' })).toBeInTheDocument()
    expect(screen.getByText('-14%')).toBeInTheDocument()
  })
})
