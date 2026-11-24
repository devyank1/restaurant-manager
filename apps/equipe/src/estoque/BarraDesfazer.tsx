import { useEffect, useState } from 'react'
import { buscarDesfazivel, desfazer } from '../api/estoque'
import type { Desfazivel } from '../api/tipos'
import { mensagemDe } from './textos'

/**
 * O último lançamento da pessoa (contagem, chegada, perda), por 10 minutos.
 * `chave` muda quando a tela recarrega: aí a barra confere de novo.
 */
export default function BarraDesfazer({ chave, onDesfez }: { chave: unknown; onDesfez: () => void }) {
  const [desfazivel, setDesfazivel] = useState<Desfazivel | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    buscarDesfazivel()
      .then((d) => vivo && setDesfazivel(d))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [chave])

  const voltar = async () => {
    setEnviando(true)
    setErro('')
    try {
      await desfazer()
      setDesfazivel(null)
      setAviso('Desfeito')
      onDesfez()
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {aviso && <p role="status">{aviso}</p>}
      {desfazivel && (
        <section className="barra-desfazer" aria-label="Desfazer">
          <span>{desfazivel.descricao}</span>
          <button type="button" className="botao botao--secundario" disabled={enviando} onClick={voltar}>
            Desfazer
          </button>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
        </section>
      )}
    </>
  )
}
