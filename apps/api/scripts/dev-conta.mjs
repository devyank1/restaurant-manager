// Liga as opções da conta no restaurante demo do banco de dev, sem rodar o
// seed (que troca os tokens das mesas). Idempotente.
//   - 10% de serviço: aparece e vem marcado;
//   - couvert: aparece, vem desmarcado, R$ 15,00 por pessoa.
// Uso: pnpm --filter api dev:conta
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const r = await prisma.restaurante.update({
    where: { slug: 'demo' },
    data: {
      servicoHabilitado: true,
      servicoPadrao: true,
      couvertHabilitado: true,
      couvertPadrao: false,
      couvertCentavos: 1500,
    },
  });
  console.log(
    `Conta da ${r.nome}: 10% ${r.servicoHabilitado ? 'ligado' : 'desligado'} (padrão ${r.servicoPadrao ? 'marcado' : 'desmarcado'}), ` +
      `couvert ${r.couvertHabilitado ? 'ligado' : 'desligado'} (padrão ${r.couvertPadrao ? 'marcado' : 'desmarcado'}, R$ ${(r.couvertCentavos / 100).toFixed(2)} por pessoa)`,
  );
} finally {
  await prisma.$disconnect();
}
