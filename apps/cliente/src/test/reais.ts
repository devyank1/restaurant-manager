import { formatarReais } from '../preco/preco'

// A Testing Library normaliza o espaço sem quebra (U+00A0) do texto renderizado,
// mas não o do texto esperado; então os testes comparam com espaço comum.
const ESPACO_SEM_QUEBRA = String.fromCharCode(0xa0)

export const reais = (centavos: number) => formatarReais(centavos).replaceAll(ESPACO_SEM_QUEBRA, ' ')
