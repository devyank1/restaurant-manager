// Cardápio público da mesa (o garçom usa para adicionar pratos e editar opções).
import type { PratoPublico } from '@cardapio/opcoes'

export type CardapioPublico = {
  restaurante: { nome: string }
  mesa: { numero: number }
  categorias: { id: string; nome: string; pratos: PratoPublico[] }[]
}
