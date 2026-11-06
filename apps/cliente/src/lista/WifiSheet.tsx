import { useRef, useState } from 'react'

export default function WifiSheet({
  ssid,
  senha,
  onFechar,
}: {
  ssid: string
  senha: string | null
  onFechar: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const senhaRef = useRef<HTMLElement>(null)

  const copiar = async () => {
    if (!senha) return
    try {
      await navigator.clipboard.writeText(senha)
      setCopiado(true)
    } catch {
      // Sem permissão de clipboard: seleciona a senha para copiar na mão.
      const alvo = senhaRef.current
      if (alvo) window.getSelection()?.selectAllChildren(alvo)
    }
  }

  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Wi-Fi do restaurante"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2>Wi-Fi para clientes</h2>
        <p className="sheet-rotulo">Rede</p>
        <p className="sheet-valor">{ssid}</p>
        {senha && (
          <>
            <p className="sheet-rotulo">Senha</p>
            <p className="sheet-valor">
              <code ref={senhaRef}>{senha}</code>
            </p>
            <button type="button" className="botao botao--primario" onClick={copiar}>
              {copiado ? 'Senha copiada' : 'Copiar senha'}
            </button>
          </>
        )}
        <button type="button" className="botao botao--secundario" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}
