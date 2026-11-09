// Dados de estoque para os testes da equipe.
import type { UsuarioEquipe } from '../api/tipos'
import type { EstoqueFalso } from './estoque-falso'

export const carla: UsuarioEquipe = { id: 'u-carla', nome: 'Carla', papel: 'DONO', emTurno: false }

export function estoqueDemo(): EstoqueFalso {
  const granja = { id: 'granja', nome: 'Granja Boa', telefone: '(11) 98888-7777', observacao: null }
  const ovos = {
    id: 'ovos',
    nome: 'Ovos',
    unidade: 'UN' as const,
    quantidade: 20,
    minimo: 30,
    cheio: 180,
    nivel: 'ACABANDO' as const,
    fornecedor: { id: granja.id, nome: granja.nome },
    embalagem: { nome: 'Cartela', quantidade: 30 },
  }
  const queijo = {
    id: 'queijo',
    nome: 'Queijo',
    unidade: 'G' as const,
    quantidade: 0,
    minimo: 2000,
    cheio: 10000,
    nivel: 'ZERADO' as const,
    fornecedor: null,
    embalagem: null,
  }
  const chopp = {
    id: 'chopp',
    nome: 'Chopp',
    unidade: 'ML' as const,
    quantidade: 30000,
    minimo: 10000,
    cheio: 50000,
    nivel: 'OK' as const,
    fornecedor: null,
    embalagem: null,
  }
  return {
    itens: [chopp, ovos, queijo],
    resumo: {
      acabando: [ovos],
      acabou: [{ ...queijo, pratos: [{ id: 'p1', nome: 'Pizza Margherita', esgotado: false }] }],
      perdasHoje: [
        {
          itemId: 'ovos',
          nome: 'Ovos',
          quantidade: 30,
          unidade: 'UN',
          motivo: 'ACIDENTE',
          observacao: null,
          criadoEm: new Date().toISOString(),
        },
      ],
      listaAberta: null,
    },
    fornecedores: [granja],
    movimentos: {
      ovos: [
        {
          id: 'm1',
          tipo: 'PERDA',
          quantidade: -30,
          motivo: 'ACIDENTE',
          observacao: null,
          usuario: 'Dani',
          criadoEm: new Date().toISOString(),
          desfeito: false,
        },
      ],
    },
    receitas: [
      {
        id: 'p1',
        nome: 'Pizza Margherita',
        categoria: 'Pizzas',
        esgotado: false,
        receita: [],
        grupos: [
          {
            id: 'g-tam',
            nome: 'Tamanho',
            tipo: 'UNICA',
            opcoes: [
              { id: 'o-m', nome: 'M', multiplicadorPct: 100, receita: [] },
              { id: 'o-g', nome: 'G', multiplicadorPct: 100, receita: [] },
            ],
          },
          {
            id: 'g-sab',
            nome: 'Sabores',
            tipo: 'SABORES',
            opcoes: [{ id: 'o-marg', nome: 'Margherita', multiplicadorPct: 100, receita: [] }],
          },
          {
            id: 'g-adi',
            nome: 'Adicionais',
            tipo: 'MULTIPLA',
            opcoes: [{ id: 'o-bacon', nome: 'Bacon', multiplicadorPct: 100, receita: [] }],
          },
        ],
      },
      {
        id: 'p2',
        nome: 'Chopp 500ml',
        categoria: 'Bebidas',
        esgotado: false,
        receita: [{ itemId: 'chopp', nome: 'Chopp', unidade: 'ML', quantidade: 500 }],
        grupos: [],
      },
    ],
    sugestao: [
      {
        fornecedor: { id: 'granja', nome: 'Granja Boa', telefone: '(11) 98888-7777' },
        itens: [
          {
            itemId: 'ovos',
            nome: 'Ovos',
            unidade: 'UN',
            quantidade: 180,
            texto: '6 Cartela (180 un)',
            embalagem: { nome: 'Cartela', quantidade: 30 },
          },
        ],
      },
      {
        fornecedor: null,
        itens: [
          { itemId: 'queijo', nome: 'Queijo', unidade: 'G', quantidade: 10000, texto: '10 kg', embalagem: null },
        ],
      },
    ],
    listas: {},
    desfazivel: null,
  }
}
