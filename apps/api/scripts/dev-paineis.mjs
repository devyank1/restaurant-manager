// Metas e tempos de preparo de demonstração no restaurante demo do banco de
// dev, sem rodar o seed. Idempotente: só preenche o que ainda está vazio
// (não sobrescreve o que o gerente mudou pelo app), nunca apaga e nunca mexe
// em vendas ou turnos — os números dos painéis vêm do uso real.
// Uso: pnpm --filter api dev:paineis
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Metas sem dono de pessoa: procura pela chave e só cria se faltar. */
const METAS = [
  { escopo: 'EQUIPE', tipo: 'VALOR', periodo: 'DIA', alvo: 300000, texto: 'meta da equipe R$ 3.000/dia' },
  { escopo: 'GARCOM', tipo: 'VALOR', periodo: 'DIA', alvo: 80000, texto: 'meta padrão do garçom R$ 800/dia' },
  { escopo: 'ESTACAO', tipo: 'NO_TEMPO', periodo: 'DIA', alvo: 85, estacao: 'Cozinha', texto: '85% no tempo na Cozinha' },
  { escopo: 'ESTACAO', tipo: 'ESQUECIDOS', periodo: 'DIA', alvo: 0, estacao: 'Cozinha', texto: 'zero esquecidos na Cozinha' },
];

async function main() {
  const r = await prisma.restaurante.findUniqueOrThrow({ where: { slug: 'demo' } });
  const feito = [];

  const pizzas = await prisma.categoria.updateMany({
    where: { restauranteId: r.id, nome: 'Pizzas', tempoPreparoMin: null },
    data: { tempoPreparoMin: 12 },
  });
  if (pizzas.count) feito.push('Pizzas: padrão de 12 min');

  const bar = await prisma.categoria.updateMany({
    where: { restauranteId: r.id, estacao: 'Bar', tempoPreparoMin: null },
    data: { tempoPreparoMin: 5 },
  });
  if (bar.count) feito.push(`Bar: padrão de 5 min (${bar.count} categoria(s))`);

  for (const { texto, ...m } of METAS) {
    const chave = {
      restauranteId: r.id,
      escopo: m.escopo,
      tipo: m.tipo,
      usuarioId: null,
      estacao: m.estacao ?? null,
    };
    if (await prisma.meta.findFirst({ where: chave })) continue;
    await prisma.meta.create({ data: { ...chave, periodo: m.periodo, alvo: m.alvo } });
    feito.push(texto);
  }

  console.log(feito.length ? `Feito:\n- ${feito.join('\n- ')}` : 'nada a fazer');
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
