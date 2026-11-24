// Estoque de demonstração no restaurante demo do banco de dev, sem rodar o
// seed (que troca os tokens das mesas). Idempotente e não apaga nada:
//   - fornecedores e itens: procura pelo nome; item que já existe só tem a
//     configuração atualizada (mínimo, cheio, fornecedor, embalagem) — a
//     quantidade fica como está, para não desfazer contagens feitas no teste;
//   - receitas: cada linha (prato/opção + item) é criada ou tem a quantidade ajustada.
// Uso: pnpm --filter api dev:estoque
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FORNECEDORES = [
  { nome: 'Granja Boa', telefone: '11900000001' },
  { nome: 'Bebidas SA', telefone: '11900000002' },
  { nome: 'Hortifrúti Central', telefone: '11900000003' },
];

const ITENS = [
  { nome: 'Ovos', unidade: 'UN', quantidade: 60, minimo: 30, cheio: 180, fornecedor: 'Granja Boa', embalagem: ['Cartela', 30] },
  { nome: 'Massa de pizza', unidade: 'G', quantidade: 6000, minimo: 3000, cheio: 15000 },
  { nome: 'Queijo muçarela', unidade: 'G', quantidade: 4000, minimo: 2000, cheio: 10000 },
  { nome: 'Calabresa', unidade: 'G', quantidade: 1500, minimo: 1000, cheio: 5000 },
  { nome: 'Bacon', unidade: 'G', quantidade: 800, minimo: 500, cheio: 3000 },
  { nome: 'Chopp Pilsen', unidade: 'ML', quantidade: 30000, minimo: 10000, cheio: 50000, fornecedor: 'Bebidas SA', embalagem: ['Barril', 30000] },
  { nome: 'Picanha', unidade: 'G', quantidade: 3000, minimo: 2000, cheio: 8000 },
];

/** prato → { receita do prato, opções: { 'Grupo/Opção': { mult?, receita } } } */
const RECEITAS = {
  'Pizza Margherita': {
    receita: { 'Massa de pizza': 300 },
    opcoes: {
      'Tamanho/P': { mult: 70 },
      'Tamanho/M': { mult: 100 },
      'Tamanho/G': { mult: 150 },
      'Sabores/Margherita': { receita: { 'Queijo muçarela': 200 } },
      'Sabores/Calabresa': { receita: { Calabresa: 150, 'Queijo muçarela': 100 } },
      'Sabores/Quatro Queijos': { receita: { 'Queijo muçarela': 300 } },
      'Adicionais/Bacon': { receita: { Bacon: 50 } },
    },
  },
  'Chopp 500ml': { receita: { 'Chopp Pilsen': 500 } },
  'Picanha na Chapa': { receita: { Picanha: 400 } },
};

async function linhaReceita(restauranteId, alvo, itemId, quantidade) {
  const existente = await prisma.receitaItem.findFirst({ where: { ...alvo, itemId } });
  if (existente) {
    await prisma.receitaItem.update({ where: { id: existente.id }, data: { quantidade } });
  } else {
    await prisma.receitaItem.create({ data: { restauranteId, ...alvo, itemId, quantidade } });
  }
}

try {
  const r = await prisma.restaurante.findUniqueOrThrow({ where: { slug: 'demo' } });

  const fornecedores = new Map();
  for (const f of FORNECEDORES) {
    const achado = await prisma.fornecedor.findFirst({ where: { restauranteId: r.id, nome: f.nome } });
    fornecedores.set(
      f.nome,
      achado ?? (await prisma.fornecedor.create({ data: { restauranteId: r.id, ...f } })),
    );
  }

  const itens = new Map();
  for (const i of ITENS) {
    const config = {
      minimo: i.minimo,
      cheio: i.cheio,
      ativo: true,
      fornecedorId: i.fornecedor ? fornecedores.get(i.fornecedor).id : null,
      embalagemNome: i.embalagem?.[0] ?? null,
      embalagemQuantidade: i.embalagem?.[1] ?? null,
    };
    const achado = await prisma.itemEstoque.findFirst({ where: { restauranteId: r.id, nome: i.nome } });
    const item = achado
      ? await prisma.itemEstoque.update({ where: { id: achado.id }, data: config })
      : await prisma.itemEstoque.create({
          data: { restauranteId: r.id, nome: i.nome, unidade: i.unidade, quantidade: i.quantidade, ...config },
        });
    const nivel = item.quantidade <= 0 ? 'ZERADO' : item.quantidade <= item.minimo ? 'ACABANDO' : 'OK';
    if (item.nivel !== nivel) await prisma.itemEstoque.update({ where: { id: item.id }, data: { nivel } });
    itens.set(i.nome, item);
  }

  for (const [nomePrato, def] of Object.entries(RECEITAS)) {
    const prato = await prisma.prato.findFirst({
      where: { restauranteId: r.id, nome: nomePrato },
      include: { grupos: { include: { opcoes: true } } },
    });
    if (!prato) {
      console.warn(`Prato não encontrado, pulei: ${nomePrato}`);
      continue;
    }
    for (const [nomeItem, q] of Object.entries(def.receita ?? {})) {
      await linhaReceita(r.id, { pratoId: prato.id }, itens.get(nomeItem).id, q);
    }
    for (const [chave, op] of Object.entries(def.opcoes ?? {})) {
      const [nomeGrupo, nomeOpcao] = chave.split('/');
      const opcao = prato.grupos.find((g) => g.nome === nomeGrupo)?.opcoes.find((o) => o.nome === nomeOpcao);
      if (!opcao) {
        console.warn(`Opção não encontrada, pulei: ${nomePrato} → ${chave}`);
        continue;
      }
      if (op.mult) await prisma.opcao.update({ where: { id: opcao.id }, data: { multiplicadorPct: op.mult } });
      for (const [nomeItem, q] of Object.entries(op.receita ?? {})) {
        await linhaReceita(r.id, { opcaoId: opcao.id }, itens.get(nomeItem).id, q);
      }
    }
  }

  console.log(`Estoque de demo pronto na ${r.nome}: ${fornecedores.size} fornecedores, ${itens.size} itens, receitas de ${Object.keys(RECEITAS).length} pratos.`);
} finally {
  await prisma.$disconnect();
}
