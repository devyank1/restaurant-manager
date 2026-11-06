import { useEffect, useState } from 'react'
import { eu, logout } from './api/equipe'
import type { UsuarioEquipe } from './api/tipos'
import Inicio from './inicio/Inicio'
import Topo from './inicio/Topo'
import Login from './login/Login'
import TodasMesas from './mesas/TodasMesas'
import { caminhoAtual, navegar, useRota } from './rotas'
import './estilo/app.css'

export default function App() {
  const rota = useRota()
  // undefined = ainda perguntando à API quem está logado.
  const [usuario, setUsuario] = useState<UsuarioEquipe | null | undefined>(undefined)

  useEffect(() => {
    eu()
      .then(setUsuario)
      .catch(() => setUsuario(null))
  }, [])

  if (usuario === undefined) return <p className="carregando">Carregando…</p>

  if (!usuario || rota.nome === 'login') {
    // Sem sessão fora do /login: depois de entrar, fica onde está.
    const volta = rota.nome === 'login' ? rota.volta : caminhoAtual()
    return (
      <Login
        onEntrou={(quem) => {
          setUsuario(quem)
          navegar(volta ?? '/')
        }}
      />
    )
  }

  const sair = async () => {
    await logout().catch(() => undefined)
    setUsuario(null)
    navegar('/login')
  }

  return (
    <div className="app">
      <Topo usuario={usuario} onMudou={setUsuario} onSair={sair} />
      {rota.nome === 'inicio' && <Inicio usuario={usuario} />}
      {rota.nome === 'mesas' && <TodasMesas />}
      {rota.nome === 'mesa' && <p className="vazio">{`Mesa ${rota.token}`}</p>}
    </div>
  )
}
