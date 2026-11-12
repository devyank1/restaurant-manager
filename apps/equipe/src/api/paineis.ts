// Chamadas da etapa 4B: tempos de preparo, metas e painéis.
import { chamar, enc, json } from './equipe'
import type { TemposCardapio } from './tipos'

const E = '/api/equipe'

// Tempo de preparo
export const buscarTempos = () => chamar<TemposCardapio>(`${E}/tempos`)
export const mudarTempoCategoria = (id: string, tempoPreparoMin: number | null) =>
  chamar<object>(`${E}/tempos/categorias/${enc(id)}`, json('PATCH', { tempoPreparoMin }))
export const mudarTempoPrato = (id: string, tempoPreparoMin: number | null) =>
  chamar<object>(`${E}/tempos/pratos/${enc(id)}`, json('PATCH', { tempoPreparoMin }))
