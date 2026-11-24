// Cenário de demonstração da Central do gerente no restaurante demo do banco
// de dev, sem rodar o seed. Cria mesas abertas (Ana com 7), uma mesa parada há
// 15 min, um chamado aberto há 5 min, um pedido na fila há 25 min (esperado
// 10 min) e um item de estoque acabando; liga Ana e Bruno em turno.
// Idempotente: tudo que cria é marcado com o dispositivo 'demo-central' (nas
// sessões) e com um Evento 'DEMO_CENTRAL' (estado anterior de turno/estoque);
// rodar de novo limpa o cenário anterior antes de recriar.
// Os alertas aparecem na Central depois de ~1 min.
// Uso: pnpm --filter api dev:central [--limpar]
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MARCA = 'demo-central';
const EVENTO = 'DEMO_CENTRAL';
const minAtras = (m) => new Date(Date.now() - m * 60_000);

async function limpar(r) {
  const sessoes = await prisma.sessaoMesa.deleteMany({
    where: { restauranteId: r.id, dispositivos: { some: { dispositivoId: MARCA } } },
  });
  const eventos = await prisma.evento.findMany({
    where: { restauranteId: r.id, tipo: EVENTO },
    orderBy: { criadoEm: 'asc' },
  });
  // O snapshot mais antigo vale: uma execução interrompida não é sobrescrita.
  const usuariosVistos = new Set();
  const itensVistos = new Set();
  const feito = [`${sessoes.count} sessão(ões) de demo removida(s) (com rodadas e chamados)`];
  for (const e of eventos) {
    const d = e.dados;
    for (const u of d.usuarios ?? []) {
      if (usuariosVistos.has(u.id)) continue;
      usuariosVistos.add(u.id);
      await prisma.usuario.update({
        where: { id: u.id },
        data: { emTurno: u.emTurno, emTurnoDesde: u.emTurnoDesde ? new Date(u.emTurnoDesde) : null },
      });
    }
    if (d.item && !itensVistos.has(d.item.id)) {
      itensVistos.add(d.item.id);
      await prisma.itemEstoque.update({
        where: { id: d.item.id },
        data: { quantidade: d.item.quantidade, nivel: d.item.nivel },
      });
      feito.push(`estoque restaurado: ${d.item.nome}`);
    }
    if (d.usuarios?.length) feito.push('turnos restaurados');
  }
  await prisma.evento.deleteMany({ where: { restauranteId: r.id, tipo: EVENTO } });
  return feito;
}

async function main() {
  const r = await prisma.restaurante.findUniqueOrThrow({ where: { slug: 'demo' } });
  const feito = await limpar(r);
  if (process.argv.includes('--limpar')) {
    console.log(`Limpo:\n- ${feito.join('\n- ')}`);
    return;
  }
  feito.length = 0;

  const ana = await prisma.usuario.findFirstOrThrow({ where: { restauranteId: r.id, email: 'ana@demo.com' } });
  const bruno = await prisma.usuario.findFirstOrThrow({ where: { restauranteId: r.id, email: 'bruno@demo.com' } });
  const prato = await prisma.prato.findFirstOrThrow({ where: { restauranteId: r.id } });
  const mesas = await prisma.mesa.findMany({
    where: { restauranteId: r.id, sessoes: { none: { status: 'ABERTA' } } },
    orderBy: { numero: 'asc' },
  });
  if (mesas.length < 3) throw new Error('Preciso de ao menos 3 mesas sem sessão aberta.');

  // Estado anterior de turno e estoque, para o --limpar devolver.
  const dados = {
    usuarios: [ana, bruno].map((u) => ({
      id: u.id,
      emTurno: u.emTurno,
      emTurnoDesde: u.emTurnoDesde?.toISOString() ?? null,
    })),
  };
  const item = await prisma.itemEstoque.findFirst({
    where: { restauranteId: r.id, ativo: true, nivel: 'OK', minimo: { gt: 0 } },
    orderBy: { nome: 'asc' },
  });
  if (item) {
    dados.item = { id: item.id, nome: item.nome, quantidade: item.quantidade, nivel: item.nivel };
    await prisma.itemEstoque.update({
      where: { id: item.id },
      data: { quantidade: Math.max(0, item.minimo - 1), nivel: 'ACABANDO' },
    });
    feito.push(`estoque: ${item.nome} acabando`);
  } else {
    feito.push('estoque: nenhum item configurado (rode dev:estoque), pulei');
  }
  await prisma.evento.create({ data: { restauranteId: r.id, tipo: EVENTO, dados } });

  await prisma.usuario.updateMany({
    where: { id: { in: [ana.id, bruno.id] } },
    data: { emTurno: true, emTurnoDesde: minAtras(30) },
  });
  feito.push('Ana e Bruno em turno');

  const abrir = (mesa, garcom, abertaEm) =>
    prisma.sessaoMesa.create({
      data: {
        restauranteId: r.id,
        mesaId: mesa.id,
        garcomId: garcom.id,
        garcomDesde: abertaEm,
        abertaEm,
        dispositivos: { create: { restauranteId: r.id, dispositivoId: MARCA, confirmado: true } },
      },
    });

  // Ana: até 7 mesas. 1ª parada há 15 min (as outras, 6 min: abaixo do limite de 10); 2ª com chamado; 3ª com pedido esquecido.
  const daAna = mesas.slice(0, 7);
  const sessoes = [];
  for (const [i, m] of daAna.entries()) sessoes.push(await abrir(m, ana, minAtras(i === 0 ? 15 : 6)));
  feito.push(`Ana com ${sessoes.length} mesa(s) aberta(s) (mesa ${daAna[0].numero} parada há 15 min)`);

  await prisma.chamado.create({
    data: {
      restauranteId: r.id,
      mesaId: daAna[1].id,
      sessaoId: sessoes[1].id,
      tipo: 'ATENDENTE',
      garcomId: ana.id,
      criadoEm: minAtras(5),
      atribuidoEm: minAtras(5),
    },
  });
  feito.push(`chamado aberto há 5 min na mesa ${daAna[1].numero}`);

  await prisma.rodada.create({
    data: {
      restauranteId: r.id,
      sessaoId: sessoes[2].id,
      dispositivoId: MARCA,
      status: 'CONFIRMADA',
      totalCentavos: 4000,
      criadoEm: minAtras(25),
      confirmadaEm: minAtras(25),
      confirmadaPorId: ana.id,
      garcomId: ana.id,
      itens: {
        create: [
          {
            restauranteId: r.id,
            pratoId: prato.id,
            nome: prato.nome,
            resumoOpcoes: '',
            selecao: {},
            observacao: '',
            quantidade: 2,
            precoUnitarioCentavos: 2000,
            estacao: 'Cozinha',
            tempoEsperadoMin: 10,
            status: 'NA_FILA',
          },
        ],
      },
    },
  });
  feito.push(`pedido na fila há 25 min (esperado 10) na mesa ${daAna[2].numero}`);

  const dele = mesas[7];
  if (dele) {
    await abrir(dele, bruno, minAtras(6));
    feito.push(`Bruno com 1 mesa aberta (mesa ${dele.numero})`);
  }

  console.log(`Cenário da Central pronto (alertas em ~1 min):\n- ${feito.join('\n- ')}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
