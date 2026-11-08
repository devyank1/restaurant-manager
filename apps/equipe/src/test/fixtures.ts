import type { PratoPublico } from '@cardapio/opcoes'
import type { CardapioPublico } from '../api/cardapio'
import type { ChamadoEquipe, MesaEquipe, MesaResumo } from '../api/tipos'

export function chamado(parcial: Partial<ChamadoEquipe> & { id: string }): ChamadoEquipe {
  return {
    tipo: 'ATENDENTE',
    status: 'ABERTO',
    mesa: { numero: 7, token: 'tok7' },
    criadoEm: new Date(Date.now() - 2 * 60_000).toISOString(),
    paraTodos: false,
    tentativas: 1,
    ...parcial,
  }
}

export const mesasDemo: MesaResumo[] = [
  { numero: 7, token: 'tok7', aberta: true, garcomNome: 'Ana', pendentes: 1, prontos: 0 },
  { numero: 8, token: 'tok8', aberta: true, garcomNome: 'Bruno', pendentes: 0, prontos: 0 },
  { numero: 9, token: 'tok9', aberta: false, garcomNome: null, pendentes: 0, prontos: 0 },
]

export const pizza: PratoPublico = {
  id: 'pizza',
  nome: 'Pizza Margherita',
  descricao: 'Molho de tomate, muçarela de búfala e manjericão.',
  precoCentavos: 0,
  precoPromocionalCentavos: null,
  destaque: true,
  esgotado: false,
  videoUrl: null,
  posterUrl: null,
  grupos: [
    {
      id: 'tam',
      nome: 'Tamanho',
      tipo: 'UNICA',
      obrigatorio: true,
      min: 1,
      max: 1,
      opcoes: [
        { id: 'p', nome: 'P', precoCentavos: 4990, precoPromocionalCentavos: null },
        { id: 'm', nome: 'M', precoCentavos: 6990, precoPromocionalCentavos: null },
        { id: 'g', nome: 'G', precoCentavos: 8990, precoPromocionalCentavos: null },
      ],
    },
    {
      id: 'sab',
      nome: 'Sabores',
      tipo: 'SABORES',
      obrigatorio: true,
      min: 1,
      max: 2,
      opcoes: [
        { id: 'margherita', nome: 'Margherita', precoCentavos: 0, precoPromocionalCentavos: null },
        { id: 'calabresa', nome: 'Calabresa', precoCentavos: 0, precoPromocionalCentavos: null },
        { id: 'quatroQueijos', nome: 'Quatro Queijos', precoCentavos: 1000, precoPromocionalCentavos: null },
      ],
    },
    {
      id: 'adic',
      nome: 'Adicionais',
      tipo: 'MULTIPLA',
      obrigatorio: false,
      min: 0,
      max: 3,
      opcoes: [
        { id: 'borda', nome: 'Borda recheada', precoCentavos: 1200, precoPromocionalCentavos: null },
        { id: 'bacon', nome: 'Bacon', precoCentavos: 800, precoPromocionalCentavos: null },
      ],
    },
  ],
}

function simples(id: string, nome: string, precoCentavos: number, esgotado = false): PratoPublico {
  return { id, nome, descricao: '', precoCentavos, precoPromocionalCentavos: null, destaque: false, esgotado, videoUrl: null, posterUrl: null, grupos: [] }
}

export const chopp = simples('chopp', 'Chopp 500ml', 1190)
export const pastel = simples('pastel', 'Pastel de Carne Seca', 3890, true)

export const cardapioDemo: CardapioPublico = {
  restaurante: { nome: 'Cantina Demo' },
  mesa: { numero: 7 },
  categorias: [
    { id: 'pizzas', nome: 'Pizzas', pratos: [pizza] },
    { id: 'petiscos', nome: 'Petiscos', pratos: [pastel] },
    { id: 'bebidas', nome: 'Bebidas', pratos: [chopp] },
  ],
}

/** Mesa 7: rodada confirmada (2 chopps) e rodada pendente de celular novo (pizza M + bacon). */
export function mesa7(): MesaEquipe {
  return {
    mesa: { numero: 7, token: 'tok7' },
    garcomNome: 'Ana',
    totalConfirmadoCentavos: 2380,
    rodadas: [
      {
        id: 'r0',
        status: 'CONFIRMADA',
        fase: 'NA_COZINHA',
        cancelavelAte: null,
        criadoEm: '2026-11-06T20:00:00.000Z',
        totalCentavos: 2380,
        dispositivoNovo: false,
        itens: [
          {
            id: 'i0',
            pratoId: 'chopp',
            nome: 'Chopp 500ml',
            resumoOpcoes: '',
            selecao: {},
            observacao: '',
            quantidade: 2,
            precoUnitarioCentavos: 1190,
            status: 'NA_FILA',
            estacao: 'Bar',
          },
        ],
      },
      {
        id: 'r1',
        status: 'AGUARDANDO_GARCOM',
        fase: 'AGUARDANDO_GARCOM',
        cancelavelAte: null,
        criadoEm: '2026-11-06T20:10:00.000Z',
        totalCentavos: 7790,
        dispositivoNovo: true,
        itens: [
          {
            id: 'i1',
            pratoId: 'pizza',
            nome: 'Pizza Margherita',
            resumoOpcoes: 'M · Margherita · Bacon',
            selecao: { tam: ['m'], sab: ['margherita'], adic: ['bacon'] },
            observacao: 'sem cebola',
            quantidade: 1,
            precoUnitarioCentavos: 7790,
            status: 'NA_FILA',
            estacao: 'Cozinha',
          },
        ],
      },
    ],
  }
}
