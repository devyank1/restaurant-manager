// Pedido ao fornecedor pelo WhatsApp: link wa.me com o texto pronto.

/** Só dígitos; número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55. */
export function linkWhatsApp(telefone: string | null, texto: string): string {
  let digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`
}

export function textoPedido(restaurante: string, fornecedor: string, linhas: { nome: string; texto: string }[]): string {
  return [`Olá, ${fornecedor}! Pedido do ${restaurante}:`, ...linhas.map((l) => `• ${l.nome}: ${l.texto}`), 'Obrigado!'].join(
    '\n',
  )
}
