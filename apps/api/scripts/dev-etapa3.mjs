// Prepara o banco de dev para a Etapa 3A sem rodar o seed (que troca os
// tokens das mesas). Idempotente: pode rodar quantas vezes quiser.
//   - cria a Dani (cozinha@demo.com / demo1234, papel COZINHA) se não existir;
//   - põe as categorias "Bebidas" na estação "Bar".
// Uso: pnpm --filter api dev:etapa3
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** Mesmo formato de src/equipe/senha.ts: `scrypt$<sal>$<hash>`. */
async function hashSenha(senha) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, 64);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

const prisma = new PrismaClient();

try {
  const restaurante = await prisma.restaurante.findUniqueOrThrow({ where: { slug: 'demo' } });

  const existente = await prisma.usuario.findUnique({ where: { email: 'cozinha@demo.com' } });
  if (existente) {
    console.log(`Dani já existe (${existente.papel}).`);
  } else {
    await prisma.usuario.create({
      data: {
        restauranteId: restaurante.id,
        nome: 'Dani',
        email: 'cozinha@demo.com',
        senhaHash: await hashSenha('demo1234'),
        papel: 'COZINHA',
      },
    });
    console.log('Dani criada: cozinha@demo.com / demo1234.');
  }

  const bar = await prisma.categoria.updateMany({
    where: { restauranteId: restaurante.id, nome: 'Bebidas' },
    data: { estacao: 'Bar' },
  });
  console.log(`Categorias no Bar: ${bar.count}.`);
} finally {
  await prisma.$disconnect();
}
