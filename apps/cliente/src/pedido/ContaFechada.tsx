/** Tela cheia depois que o garçom fecha a conta: agradece e pede a avaliação. */
export default function ContaFechada({
  avaliacaoUrl,
  onVoltar,
}: {
  avaliacaoUrl: string | null
  onVoltar: () => void
}) {
  return (
    <div className="conta-fechada" role="dialog" aria-modal="true" aria-label="Conta fechada">
      <h1>Conta fechada</h1>
      <p>Obrigado pela visita!</p>
      {avaliacaoUrl && (
        <a className="avaliar avaliar--destaque" href={avaliacaoUrl} target="_blank" rel="noopener noreferrer">
          ⭐ Avalie no Google
        </a>
      )}
      <button type="button" className="conta-fechada-voltar" onClick={onVoltar}>
        Voltar ao cardápio
      </button>
    </div>
  )
}
