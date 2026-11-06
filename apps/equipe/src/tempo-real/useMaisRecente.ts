import { useCallback, useEffect, useRef } from 'react'

/**
 * Busca e aplica só a resposta do pedido mais recente. Com rede de celular,
 * duas buscas seguidas (desbloquear + reconectar, ação + evento) podem voltar
 * fora de ordem; a mais velha não pode apagar a mais nova.
 * Falha de rede: mantém o que já tinha (`aoFalhar` decide se faz algo).
 */
export function useMaisRecente<T>(
  buscar: () => Promise<T>,
  aplicar: (valor: T) => void,
  aoFalhar?: (erro: unknown) => void,
): () => Promise<void> {
  const ultimo = useRef(0)
  const atual = useRef({ buscar, aplicar, aoFalhar })
  useEffect(() => {
    atual.current = { buscar, aplicar, aoFalhar }
  })

  return useCallback(() => {
    const meu = ++ultimo.current
    return atual.current.buscar().then(
      (valor) => {
        if (meu === ultimo.current) atual.current.aplicar(valor)
      },
      (erro: unknown) => {
        if (meu === ultimo.current) atual.current.aoFalhar?.(erro)
      },
    )
  }, [])
}
