import { describe, expect, it } from 'vitest'
import { linkWhatsApp, textoPedido } from './whatsapp'

describe('WhatsApp do fornecedor', () => {
  it('link com DDI 55 e só dígitos', () => {
    expect(linkWhatsApp('(11) 98888-7777', 'oi')).toBe('https://wa.me/5511988887777?text=oi')
    expect(linkWhatsApp('5511988887777', 'a b')).toBe('https://wa.me/5511988887777?text=a%20b')
    expect(linkWhatsApp('1133334444', 'x')).toBe('https://wa.me/551133334444?text=x')
  })

  it('sem telefone abre o WhatsApp para escolher o contato', () => {
    expect(linkWhatsApp(null, 'oi')).toBe('https://wa.me/?text=oi')
    expect(linkWhatsApp('', 'oi')).toBe('https://wa.me/?text=oi')
  })

  it('texto do pedido', () => {
    expect(
      textoPedido('Cantina Demo', 'Granja Boa', [
        { nome: 'Ovos', texto: '4 Cartela (120 un)' },
        { nome: 'Queijo', texto: '10 kg' },
      ]),
    ).toBe('Olá, Granja Boa! Pedido do Cantina Demo:\n• Ovos: 4 Cartela (120 un)\n• Queijo: 10 kg\nObrigado!')
  })
})
