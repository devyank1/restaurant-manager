import { useCallback, useEffect, useState } from 'react'
import { buscarCardapio, ErroMesaNaoEncontrada } from './api/cardapio'
import type { CardapioPublico } from './api/tipos'
import { extrairToken } from './rota'

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; cardapio: CardapioPublico }
  | { tipo: 'nao-encontrada' }
  | { tipo: 'erro' }

export default function App() {
  const token = extrairToken(window.location.pathname)
  const [estado, setEstado] = useState<Estado>(
    token ? { tipo: 'carregando' } : { tipo: 'nao-encontrada' },
  )

  const buscar = useCallback(() => {
    if (!token) return
    buscarCardapio(token)
      .then((cardapio) => setEstado({ tipo: 'pronto', cardapio }))
      .catch((erro: unknown) =>
        setEstado(erro instanceof ErroMesaNaoEncontrada ? { tipo: 'nao-encontrada' } : { tipo: 'erro' }),
      )
  }, [token])

  useEffect(buscar, [buscar])

  const tentarNovamente = () => {
    setEstado({ tipo: 'carregando' })
    buscar()
  }

  switch (estado.tipo) {
    case 'carregando':
      return <main className="aviso-tela" aria-busy="true">Carregando cardápio…</main>
    case 'nao-encontrada':
      return (
        <main className="aviso-tela">
          <h1>Mesa não encontrada</h1>
          <p>Peça ajuda ao atendente.</p>
        </main>
      )
    case 'erro':
      return (
        <main className="aviso-tela">
          <h1>Não foi possível carregar o cardápio</h1>
          <button type="button" onClick={tentarNovamente}>
            Tentar novamente
          </button>
        </main>
      )
    case 'pronto':
      return <h1>{estado.cardapio.restaurante.nome}</h1>
  }
}
