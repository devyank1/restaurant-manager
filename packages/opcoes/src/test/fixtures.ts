import type { PratoPublico } from '../tipos'

export const mix: PratoPublico = {
  id: 'mix',
  nome: 'Mix da Casa',
  descricao: 'Bolinho de costela, mini coxinha, torresmo, isca de tilápia e mandioca frita.',
  precoCentavos: 6990,
  precoPromocionalCentavos: 5990,
  destaque: true,
  esgotado: false,
  videoUrl: '/demo/videos/mix-da-casa.mp4',
  posterUrl: '/demo/videos/mix-da-casa.jpg',
  grupos: [],
}

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
