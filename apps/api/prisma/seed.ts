import { PrismaClient, TipoGrupoOpcao } from '@prisma/client';
import { gerarTokenMesa } from '../src/mesas/token';

type OpcaoSeed = { nome: string; precoCentavos: number };

type GrupoSeed = {
  nome: string;
  tipo: TipoGrupoOpcao;
  obrigatorio: boolean;
  min: number;
  max: number;
  opcoes: OpcaoSeed[];
};

type PratoSeed = {
  nome: string;
  descricao: string;
  precoCentavos: number;
  precoPromocionalCentavos?: number;
  destaque?: boolean;
  esgotado?: boolean;
  /** Slug do vídeo em apps/cliente/public/demo/videos (gera .mp4 e .jpg). */
  video?: string;
  grupos?: GrupoSeed[];
};

const SLUG_DEMO = 'demo';
const TOTAL_MESAS = 10;
const PASTA_VIDEOS = '/demo/videos';

const CARDAPIO: { categoria: string; pratos: PratoSeed[] }[] = [
  {
    categoria: 'Entradas',
    pratos: [
      {
        nome: 'Mix da Casa',
        video: 'mix-da-casa',
        descricao:
          'Bolinho de costela, mini coxinha, torresmo, isca de tilápia e mandioca frita.',
        precoCentavos: 6990,
        precoPromocionalCentavos: 5990,
        destaque: true,
      },
      {
        nome: 'Bruschetta Clássica',
        descricao: 'Pão italiano, tomate, manjericão fresco e azeite.',
        precoCentavos: 3290,
      },
      {
        nome: 'Pastel de Carne Seca',
        descricao: 'Seis unidades com catupiry.',
        precoCentavos: 3890,
        esgotado: true,
      },
    ],
  },
  {
    categoria: 'Pizzas',
    pratos: [
      {
        nome: 'Pizza Margherita',
        video: 'pizza-margherita',
        descricao: 'Molho de tomate, muçarela de búfala e manjericão.',
        // Preço definido pelo tamanho escolhido.
        precoCentavos: 0,
        destaque: true,
        grupos: [
          {
            nome: 'Tamanho',
            tipo: TipoGrupoOpcao.UNICA,
            obrigatorio: true,
            min: 1,
            max: 1,
            opcoes: [
              { nome: 'P', precoCentavos: 4990 },
              { nome: 'M', precoCentavos: 6990 },
              { nome: 'G', precoCentavos: 8990 },
            ],
          },
          {
            nome: 'Sabores',
            tipo: TipoGrupoOpcao.SABORES,
            obrigatorio: true,
            min: 1,
            max: 2,
            opcoes: [
              { nome: 'Margherita', precoCentavos: 0 },
              { nome: 'Calabresa', precoCentavos: 0 },
              { nome: 'Quatro Queijos', precoCentavos: 1000 },
            ],
          },
          {
            nome: 'Adicionais',
            tipo: TipoGrupoOpcao.MULTIPLA,
            obrigatorio: false,
            min: 0,
            max: 3,
            opcoes: [
              { nome: 'Borda recheada', precoCentavos: 1200 },
              { nome: 'Bacon', precoCentavos: 800 },
            ],
          },
        ],
      },
    ],
  },
  {
    categoria: 'Pratos',
    pratos: [
      {
        nome: 'Parmegiana da Casa',
        video: 'parmegiana-da-casa',
        descricao: 'Filé empanado, molho de tomate, muçarela, arroz e fritas.',
        precoCentavos: 7490,
      },
      {
        nome: 'Risoto de Cogumelos',
        descricao: 'Arroz arbóreo, shiitake, shimeji e parmesão.',
        precoCentavos: 6890,
      },
      {
        nome: 'Picanha na Chapa',
        video: 'picanha-na-chapa',
        descricao: 'Picanha fatiada, farofa, vinagrete e arroz.',
        precoCentavos: 9890,
        precoPromocionalCentavos: 8990,
      },
    ],
  },
  {
    categoria: 'Bebidas',
    pratos: [
      {
        nome: 'Chopp 500ml',
        video: 'chopp-500ml',
        descricao: 'Pilsen gelado.',
        precoCentavos: 1490,
        precoPromocionalCentavos: 1190,
      },
      {
        nome: 'Suco Natural',
        descricao: 'Laranja, limão ou abacaxi com hortelã.',
        precoCentavos: 990,
      },
      {
        nome: 'Refrigerante Lata',
        descricao: '350ml.',
        precoCentavos: 690,
      },
    ],
  },
  {
    categoria: 'Sobremesas',
    pratos: [
      {
        nome: 'Petit Gâteau',
        video: 'petit-gateau',
        descricao: 'Bolo quente de chocolate com sorvete de creme.',
        precoCentavos: 2890,
      },
      {
        nome: 'Pudim de Leite',
        descricao: 'Receita da casa.',
        precoCentavos: 1690,
      },
    ],
  },
];

export async function seedDemo(
  prisma: PrismaClient,
): Promise<{ restauranteId: string }> {
  return prisma.$transaction(
    async (tx) => {
      // Mantém os tokens já gravados nas etiquetas NFC da demo.
      const mesasAnteriores = await tx.mesa.findMany({
        where: { restaurante: { slug: SLUG_DEMO } },
      });
      const tokenPorNumero = new Map(
        mesasAnteriores.map((mesa) => [mesa.numero, mesa.token]),
      );

      await tx.restaurante.deleteMany({ where: { slug: SLUG_DEMO } });

      const restaurante = await tx.restaurante.create({
        data: {
          nome: 'Cantina Demo',
          slug: SLUG_DEMO,
          wifiSsid: 'Cantina-Clientes',
          wifiSenha: 'bemvindo123',
          googleAvaliacaoUrl: 'https://g.page/r/demo/review',
        },
      });
      const restauranteId = restaurante.id;

      await tx.mesa.createMany({
        data: Array.from({ length: TOTAL_MESAS }, (_, i) => ({
          restauranteId,
          numero: i + 1,
          token: tokenPorNumero.get(i + 1) ?? gerarTokenMesa(),
        })),
      });

      for (const [ordemCategoria, secao] of CARDAPIO.entries()) {
        const categoria = await tx.categoria.create({
          data: { restauranteId, nome: secao.categoria, ordem: ordemCategoria },
        });

        for (const [ordemPrato, prato] of secao.pratos.entries()) {
          const { grupos = [], video, ...dados } = prato;
          const criado = await tx.prato.create({
            data: {
              ...dados,
              videoUrl: video ? `${PASTA_VIDEOS}/${video}.mp4` : null,
              posterUrl: video ? `${PASTA_VIDEOS}/${video}.jpg` : null,
              restauranteId,
              categoriaId: categoria.id,
              ordem: ordemPrato,
            },
          });

          for (const [ordemGrupo, grupo] of grupos.entries()) {
            const { opcoes, ...dadosGrupo } = grupo;
            await tx.grupoOpcao.create({
              data: {
                ...dadosGrupo,
                restauranteId,
                pratoId: criado.id,
                ordem: ordemGrupo,
                opcoes: {
                  create: opcoes.map((opcao, ordemOpcao) => ({
                    ...opcao,
                    restauranteId,
                    ordem: ordemOpcao,
                  })),
                },
              },
            });
          }
        }
      }

      return { restauranteId };
    },
    { timeout: 20_000 },
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { restauranteId } = await seedDemo(prisma);
    console.log(`Restaurante demo criado: ${restauranteId}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
