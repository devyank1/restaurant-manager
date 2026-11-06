import { useState, type FormEvent } from 'react'
import { ErroNaoAutenticado, login } from '../api/equipe'
import type { UsuarioEquipe } from '../api/tipos'

export default function Login({ onEntrou }: { onEntrou: (usuario: UsuarioEquipe) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault()
    setEntrando(true)
    setErro('')
    try {
      onEntrou(await login(email.trim(), senha))
    } catch (falha) {
      setErro(falha instanceof ErroNaoAutenticado ? 'E-mail ou senha inválidos' : 'Sem conexão. Tente de novo.')
      setEntrando(false)
    }
  }

  return (
    <main className="login">
      <h1>Equipe</h1>
      <form onSubmit={enviar}>
        <label className="campo">
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="botao botao--primario" disabled={entrando}>
          Entrar
        </button>
      </form>
    </main>
  )
}
