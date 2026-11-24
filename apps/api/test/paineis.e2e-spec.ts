import type { StatusRodada } from '@prisma/client';
import request from 'supertest';
import { AppTeste, contarEventos, criarAppTeste, loginComo } from './app-teste';

type Tempos = {
  categorias: {
    id: string;
    nome: string;
    estacao: string;
    tempoPreparoMin: number | null;
    pratos: { id: string; nome: string; tempoPreparoMin: number | null }[];
  }[];
};

describe('painéis', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro-paineis' } });
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());

  describe('tempos de preparo', () => {
    beforeEach(async () => {
      await t.prisma.categoria.updateMany({ data: { tempoPreparoMin: null } });
      await t.prisma.prato.updateMany({ data: { tempoPreparoMin: null } });
    });

    const tempos = async () =>
      (await http().get('/equipe/tempos').set('Cookie', dono).expect(200))
        .body as Tempos;

    it('gerente define o padrão da categoria e o tempo do prato', async () => {
      const antes = await tempos();
      const categoria = antes.categorias[0];
      const prato = categoria.pratos[0];
      expect(categoria.tempoPreparoMin).toBeNull();
      await http()
        .patch(`/equipe/tempos/categorias/${categoria.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 12 })
        .expect(200);
      await http()
        .patch(`/equipe/tempos/pratos/${prato.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 25 })
        .expect(200);
      const depois = await tempos();
      const c = depois.categorias.find((x) => x.id === categoria.id)!;
      expect(c.tempoPreparoMin).toBe(12);
      expect(c.pratos.find((p) => p.id === prato.id)!.tempoPreparoMin).toBe(25);
      await http()
        .patch(`/equipe/tempos/pratos/${prato.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: null })
        .expect(200);
      const zerado = await tempos();
      expect(
        zerado.categorias
          .find((x) => x.id === categoria.id)!
          .pratos.find((p) => p.id === prato.id)!.tempoPreparoMin,
      ).toBeNull();
    });

    it('categorias vêm na ordem do cardápio, com a estação', async () => {
      const { categorias } = await tempos();
      const ordem = await t.prisma.categoria.findMany({
        where: { restauranteId: t.restauranteId },
        orderBy: { ordem: 'asc' },
      });
      expect(categorias.map((c) => c.id)).toEqual(ordem.map((c) => c.id));
      expect(categorias[0].estacao).toBe(ordem[0].estacao);
    });

    it('garçom recebe 403 em /equipe/tempos', async () => {
      await http().get('/equipe/tempos').set('Cookie', ana).expect(403);
    });

    it('tempo 0 ou 241 dá 422', async () => {
      const { categorias } = await tempos();
      for (const tempoPreparoMin of [0, 241, 2.5]) {
        await http()
          .patch(`/equipe/tempos/categorias/${categorias[0].id}`)
          .set('Cookie', dono)
          .send({ tempoPreparoMin })
          .expect(422);
      }
    });

    it('prato de outro restaurante dá 404', async () => {
      const outro = await t.prisma.restaurante.create({
        data: { nome: 'Outro', slug: 'outro-paineis' },
      });
      const cat = await t.prisma.categoria.create({
        data: { restauranteId: outro.id, nome: 'X', ordem: 1 },
      });
      const prato = await t.prisma.prato.create({
        data: {
          restauranteId: outro.id,
          categoriaId: cat.id,
          nome: 'Y',
          descricao: '',
          precoCentavos: 100,
          ordem: 1,
        },
      });
      await http()
        .patch(`/equipe/tempos/pratos/${prato.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 10 })
        .expect(404);
      await http()
        .patch(`/equipe/tempos/categorias/${cat.id}`)
        .set('Cookie', dono)
        .send({ tempoPreparoMin: 10 })
        .expect(404);
    });
  });
  describe('painel', () => {
    type Progresso = {
      tipo: string;
      periodo: string;
      alvo: number;
      atual: number;
      batida: boolean;
      pct: number;
    };
    type Cartao = {
      id: string;
      nome: string;
      emTurno: boolean;
      avisos: string[];
      metas: Progresso[];
      mesasHoje: number;
    };
    type Medida = {
      estacao: string;
      pedidos: number;
      avaliados: number;
      noTempo: number;
      noTempoPct: number | null;
      mediaMin: number | null;
      esquecidos: { rodadaId: string; mesa: number; minutos: number }[];
    };
    type Painel = {
      periodo: string;
      inicio: string;
      metaEquipe: Progresso[];
      pessoas: Cartao[];
      operacao: {
        faturamentoCentavos: number;
        contas: number;
        ticketMedioCentavos: number | null;
        porHora: { hora: number; rodadas: number }[];
        porDiaSemana: { dia: number; mediaRodadas: number }[];
        maisVendidos: { nome: string; quantidade: number }[];
        estacoes: Medida[];
        chamadosDemorados: {
          quantidade: number;
          mediaRespostaSeg: number | null;
        };
        perdasSemana: Record<string, unknown>[];
      };
    };

    let cozinha: string;
    let bruno: string;
    let anaId: string;
    let brunoId: string;
    let mesas: { id: string; numero: number; token: string }[];
    let pratoId: string;
    let mixPreco: number;

    beforeAll(async () => {
      cozinha = await loginComo(t.app, 'cozinha@demo.com');
      bruno = await loginComo(t.app, 'bruno@demo.com');
      const id = async (email: string) =>
        (await t.prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
      anaId = await id('ana@demo.com');
      brunoId = await id('bruno@demo.com');
      mesas = await t.prisma.mesa.findMany({
        where: { restauranteId: t.restauranteId },
        orderBy: { numero: 'asc' },
      });
      const mix = await t.prisma.prato.findFirstOrThrow({
        where: { nome: 'Mix da Casa' },
      });
      pratoId = mix.id;
      mixPreco = mix.precoPromocionalCentavos ?? mix.precoCentavos;
    });

    beforeEach(async () => {
      await t.prisma.sessaoMesa.deleteMany();
      await t.prisma.evento.deleteMany();
      await t.prisma.meta.deleteMany();
      await t.prisma.turnoEquipe.deleteMany();
      await t.prisma.itemEstoque.deleteMany({ where: { nome: 'Teste perda' } });
      await t.prisma.usuario.updateMany({
        data: { emTurno: false, emTurnoDesde: null, ultimoChamadoEm: null },
      });
      await t.prisma.restaurante.update({
        where: { id: t.restauranteId },
        data: { horasSemPausa: 4, janelaCancelamentoSegundos: 120 },
      });
    });

    afterAll(async () => {
      await t.prisma.itemEstoque.deleteMany({ where: { nome: 'Teste perda' } });
    });

    const minAtras = (min: number) => new Date(Date.now() - min * 60_000);
    let proximaMesa = 0;
    const mesa = () => mesas[proximaMesa++ % mesas.length];

    type ItemNovo = {
      nome?: string;
      quantidade?: number;
      estacao?: string;
      tempoEsperadoMin?: number;
      prontoEm?: Date | null;
    };
    /** Sessão aberta com uma rodada gravada direto no banco. */
    const rodada = async (o: {
      garcomId?: string | null;
      total?: number;
      status?: StatusRodada;
      confirmadaEm?: Date;
      itens?: ItemNovo[];
      mesaId?: string;
    }) => {
      const m = o.mesaId ?? mesa().id;
      const sessao = await t.prisma.sessaoMesa.create({
        data: { restauranteId: t.restauranteId, mesaId: m },
      });
      const status = o.status ?? 'CONFIRMADA';
      return t.prisma.rodada.create({
        data: {
          restauranteId: t.restauranteId,
          sessaoId: sessao.id,
          dispositivoId: 'teste',
          status,
          totalCentavos: o.total ?? 1000,
          confirmadaEm:
            status === 'AGUARDANDO_GARCOM'
              ? null
              : (o.confirmadaEm ?? minAtras(1)),
          garcomId: o.garcomId ?? null,
          itens: {
            create: (o.itens ?? [{}]).map((i) => ({
              restauranteId: t.restauranteId,
              pratoId,
              nome: i.nome ?? 'Mix da Casa',
              resumoOpcoes: '',
              selecao: {},
              observacao: '',
              quantidade: i.quantidade ?? 1,
              precoUnitarioCentavos: 1000,
              estacao: i.estacao ?? 'Cozinha',
              tempoEsperadoMin: i.tempoEsperadoMin ?? 15,
              status: i.prontoEm ? 'PRONTO' : 'NA_FILA',
              prontoEm: i.prontoEm ?? null,
            })),
          },
        },
      });
    };
    /** Conta fechada agora, com o garçom responsável. */
    const contaFechada = (garcomId: string | null, total = 5000) =>
      t.prisma.sessaoMesa.create({
        data: {
          restauranteId: t.restauranteId,
          mesaId: mesa().id,
          status: 'FECHADA',
          garcomId,
          fechadaEm: minAtras(1),
          totalCentavos: total,
          subtotalCentavos: total,
        },
      });
    const trabalhouHoje = (usuarioId: string) =>
      t.prisma.turnoEquipe.create({
        data: {
          restauranteId: t.restauranteId,
          usuarioId,
          inicio: minAtras(60),
          fim: minAtras(30),
        },
      });
    const meta = (data: {
      escopo: 'EQUIPE' | 'GARCOM' | 'ESTACAO';
      tipo: 'VALOR' | 'MESAS' | 'NO_TEMPO' | 'ESQUECIDOS';
      alvo: number;
      periodo?: 'DIA' | 'SEMANA';
      usuarioId?: string;
      estacao?: string;
    }) =>
      t.prisma.meta.create({
        data: { restauranteId: t.restauranteId, periodo: 'DIA', ...data },
      });
    const painel = async (periodo = 'DIA') =>
      (
        await http()
          .get(`/equipe/painel?periodo=${periodo}`)
          .set('Cookie', dono)
          .expect(200)
      ).body as Painel;
    const ligar = (cookie: string) =>
      http()
        .patch('/equipe/turno')
        .set('Cookie', cookie)
        .send({ emTurno: true });
    const cartao = (p: Painel, nome: string) =>
      p.pessoas.find((x) => x.nome === nome)!;

    it('valor vendido da Ana conta só rodadas confirmadas e não canceladas, sem 10%', async () => {
      await ligar(ana);
      await meta({ escopo: 'GARCOM', tipo: 'VALOR', alvo: 10000 });
      await rodada({ garcomId: anaId, total: 3000 });
      await rodada({ garcomId: anaId, total: 2000 });
      await rodada({ garcomId: anaId, total: 5000, status: 'CANCELADA' });
      await rodada({
        garcomId: anaId,
        total: 700,
        status: 'AGUARDANDO_GARCOM',
      });
      await rodada({
        garcomId: anaId,
        total: 900,
        confirmadaEm: minAtras(60 * 24 * 8),
      });
      const metas = cartao(await painel(), 'Ana').metas;
      expect(metas).toEqual([
        {
          tipo: 'VALOR',
          periodo: 'DIA',
          alvo: 10000,
          atual: 5000,
          batida: false,
          pct: 50,
        },
      ]);
    });

    it('mesa sem garçom entra no total da equipe e em nenhum cartão', async () => {
      await ligar(ana);
      await meta({ escopo: 'EQUIPE', tipo: 'VALOR', alvo: 6000 });
      await meta({ escopo: 'GARCOM', tipo: 'VALOR', alvo: 10000 });
      await rodada({ garcomId: anaId, total: 5000 });
      await rodada({ garcomId: null, total: 1500 });
      const p = await painel();
      expect(p.metaEquipe).toEqual([
        {
          tipo: 'VALOR',
          periodo: 'DIA',
          alvo: 6000,
          atual: 6500,
          batida: true,
          pct: 100,
        },
      ]);
      expect(p.pessoas.map((x) => x.nome)).toEqual(['Ana']);
      expect(cartao(p, 'Ana').metas[0].atual).toBe(5000);
    });

    it('mesas atendidas contam a conta fechada do responsável', async () => {
      await ligar(ana);
      await trabalhouHoje(brunoId);
      await meta({ escopo: 'GARCOM', tipo: 'MESAS', alvo: 5 });
      await meta({
        escopo: 'EQUIPE',
        tipo: 'MESAS',
        alvo: 10,
        periodo: 'SEMANA',
      });
      await contaFechada(anaId);
      await contaFechada(anaId);
      await contaFechada(brunoId);
      await contaFechada(null);
      const p = await painel();
      expect(cartao(p, 'Ana').mesasHoje).toBe(2);
      expect(cartao(p, 'Ana').metas).toEqual([
        {
          tipo: 'MESAS',
          periodo: 'DIA',
          alvo: 5,
          atual: 2,
          batida: false,
          pct: 40,
        },
      ]);
      expect(cartao(p, 'Bruno').mesasHoje).toBe(1);
      expect(p.metaEquipe[0]).toMatchObject({ periodo: 'SEMANA', atual: 4 });
    });

    it('cartões em ordem alfabética, com garçom em turno e quem trabalhou hoje', async () => {
      await ligar(bruno);
      expect((await painel()).pessoas.map((x) => x.nome)).toEqual(['Bruno']);
      await trabalhouHoje(anaId);
      const p = await painel();
      expect(p.pessoas.map((x) => [x.nome, x.emTurno])).toEqual([
        ['Ana', false],
        ['Bruno', true],
      ]);
      expect(p.pessoas.map((x) => x.nome)).not.toContain('Carla');
    });

    it('garçom sem meta padrão tem metas []', async () => {
      await ligar(ana);
      await rodada({ garcomId: anaId, total: 3000 });
      expect(cartao(await painel(), 'Ana').metas).toEqual([]);
    });

    it('ajuste por pessoa vence o padrão no cartão', async () => {
      await ligar(ana);
      await ligar(bruno);
      await meta({
        escopo: 'GARCOM',
        tipo: 'VALOR',
        alvo: 10000,
        periodo: 'SEMANA',
      });
      await meta({
        escopo: 'GARCOM',
        tipo: 'VALOR',
        alvo: 4000,
        periodo: 'SEMANA',
        usuarioId: anaId,
      });
      const p = await painel();
      expect(cartao(p, 'Ana').metas[0]).toMatchObject({
        alvo: 4000,
        periodo: 'SEMANA',
      });
      expect(cartao(p, 'Bruno').metas[0]).toMatchObject({ alvo: 10000 });
    });

    it('aviso de horas sem pausa e de mesas a mais', async () => {
      await ligar(ana);
      await t.prisma.usuario.update({
        where: { id: anaId },
        data: { emTurnoDesde: minAtras(5 * 60 + 10) },
      });
      await trabalhouHoje(brunoId);
      for (let i = 0; i < 4; i++) await contaFechada(anaId);
      const p = await painel();
      expect(cartao(p, 'Ana').avisos).toEqual([
        '5 h em turno sem pausa',
        'Pegou bem mais mesas que os colegas',
      ]);
      expect(cartao(p, 'Bruno').avisos).toEqual([]);
    });

    it('painel/eu traz só a própria pessoa', async () => {
      await ligar(ana);
      await ligar(bruno);
      await meta({ escopo: 'EQUIPE', tipo: 'MESAS', alvo: 3 });
      await contaFechada(brunoId);
      const res = await http()
        .get('/equipe/painel/eu')
        .set('Cookie', ana)
        .expect(200);
      const corpo = res.body as { metaEquipe: Progresso[]; eu: Cartao };
      expect(corpo.eu).toMatchObject({
        id: anaId,
        nome: 'Ana',
        emTurno: true,
        mesasHoje: 0,
      });
      expect(corpo.metaEquipe[0]).toMatchObject({ tipo: 'MESAS', atual: 1 });
      expect(JSON.stringify(corpo)).not.toContain('Bruno');
      expect(JSON.stringify(corpo)).not.toContain(brunoId);
    });

    it('garçom recebe 403 em /equipe/painel; cozinha recebe 403 em /painel/eu', async () => {
      await http().get('/equipe/painel').set('Cookie', ana).expect(403);
      await http().get('/equipe/painel/eu').set('Cookie', cozinha).expect(403);
      await http().get('/equipe/painel/eu').set('Cookie', dono).expect(403);
      await http()
        .get('/equipe/painel/estacao/Cozinha')
        .set('Cookie', ana)
        .expect(403);
      await http()
        .get('/equipe/painel?periodo=MES')
        .set('Cookie', dono)
        .expect(422);
      await http()
        .get('/equipe/painel/estacao/Lava-jato')
        .set('Cookie', cozinha)
        .expect(404);
    });

    it('painel da estação: no tempo, atrasado e esquecido', async () => {
      await meta({
        escopo: 'ESTACAO',
        tipo: 'NO_TEMPO',
        alvo: 85,
        estacao: 'Cozinha',
      });
      await meta({
        escopo: 'ESTACAO',
        tipo: 'ESQUECIDOS',
        alvo: 0,
        estacao: 'Cozinha',
      });
      const m = mesa();
      // No tempo: 10 min de 15 esperados.
      await rodada({
        confirmadaEm: minAtras(20),
        itens: [{ tempoEsperadoMin: 15, prontoEm: minAtras(10) }],
      });
      // Atrasado: 16 min de 10 esperados (passou de 11, não do dobro).
      await rodada({
        confirmadaEm: minAtras(21),
        itens: [{ tempoEsperadoMin: 10, prontoEm: minAtras(5) }],
      });
      // Esquecido: 40 min e nada pronto, esperado 15.
      const esquecida = await rodada({
        mesaId: m.id,
        confirmadaEm: minAtras(40),
        itens: [
          { tempoEsperadoMin: 15 },
          { tempoEsperadoMin: 12, prontoEm: minAtras(1) },
        ],
      });
      // Outra estação não entra.
      await rodada({ itens: [{ estacao: 'Bar', tempoEsperadoMin: 5 }] });

      const res = await http()
        .get('/equipe/painel/estacao/Cozinha')
        .set('Cookie', cozinha)
        .expect(200);
      const corpo = res.body as {
        estacao: string;
        metas: Progresso[];
        medida: Medida;
      };
      expect(corpo.medida).toMatchObject({
        estacao: 'Cozinha',
        pedidos: 3,
        avaliados: 3,
        noTempo: 1,
        noTempoPct: 33,
        mediaMin: 13,
      });
      expect(corpo.medida.esquecidos).toEqual([
        { rodadaId: esquecida.id, mesa: m.numero, minutos: 40 },
      ]);
      expect(corpo.metas.map((x) => [x.tipo, x.atual, x.batida])).toEqual([
        ['NO_TEMPO', 33, false],
        ['ESQUECIDOS', 1, false],
      ]);
      expect(JSON.stringify(corpo)).not.toMatch(/Ana|Bruno|Dani/);
    });

    it('zero esquecidos não comemora com a noite em andamento', async () => {
      await meta({
        escopo: 'ESTACAO',
        tipo: 'ESQUECIDOS',
        alvo: 0,
        estacao: 'Cozinha',
      });
      const res = await http()
        .get('/equipe/painel/estacao/Cozinha')
        .set('Cookie', cozinha)
        .expect(200);
      const { metas } = res.body as { metas: Progresso[] };
      expect(metas).toEqual([
        {
          tipo: 'ESQUECIDOS',
          periodo: 'DIA',
          alvo: 0,
          atual: 0,
          batida: false,
          pct: 100,
        },
      ]);
    });

    it('perdas da semana sem nome de quem avisou', async () => {
      const item = await t.prisma.itemEstoque.create({
        data: {
          restauranteId: t.restauranteId,
          nome: 'Teste perda',
          unidade: 'G',
        },
      });
      const perda = (quantidade: number, desfeitoEm: Date | null = null) =>
        t.prisma.movimentoEstoque.create({
          data: {
            restauranteId: t.restauranteId,
            itemId: item.id,
            tipo: 'PERDA',
            quantidade,
            motivo: 'VALIDADE',
            usuarioId: anaId,
            lote: `l-${quantidade}`,
            desfeitoEm,
          },
        });
      await perda(-300);
      await perda(-200);
      await perda(-999, new Date());
      const perdas = (await painel()).operacao.perdasSemana;
      expect(perdas).toEqual([
        {
          item: 'Teste perda',
          unidade: 'G',
          quantidade: 500,
          motivo: 'VALIDADE',
        },
      ]);
    });

    it('números da operação: faturamento, ticket, por hora e chamados demorados', async () => {
      await contaFechada(anaId, 4000);
      await contaFechada(null, 6000);
      await rodada({ itens: [{ nome: 'Pizza', quantidade: 2 }] });
      await rodada({
        itens: [
          { nome: 'Suco', quantidade: 1 },
          { nome: 'Pizza', quantidade: 1 },
        ],
      });
      const s = await t.prisma.sessaoMesa.findFirstOrThrow({
        where: { status: 'ABERTA' },
      });
      const chamado = (criadoEm: Date, lidoEm: Date | null) =>
        t.prisma.chamado.create({
          data: {
            restauranteId: t.restauranteId,
            mesaId: s.mesaId,
            sessaoId: s.id,
            tipo: 'ATENDENTE',
            criadoEm,
            lidoEm,
          },
        });
      await chamado(minAtras(5), minAtras(4));
      await chamado(minAtras(10), null);
      const o = (await painel()).operacao;
      expect(o).toMatchObject({
        faturamentoCentavos: 10000,
        contas: 2,
        ticketMedioCentavos: 5000,
      });
      expect(o.maisVendidos).toEqual([
        { nome: 'Pizza', quantidade: 3 },
        { nome: 'Suco', quantidade: 1 },
      ]);
      const hora = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(minAtras(1)),
      );
      expect(o.porHora).toEqual([{ hora, rodadas: 2 }]);
      expect(o.porDiaSemana).toHaveLength(7);
      expect(o.chamadosDemorados.quantidade).toBe(1);
      expect(o.chamadosDemorados.mediaRespostaSeg).toBeGreaterThanOrEqual(329);
      expect(o.chamadosDemorados.mediaRespostaSeg).toBeLessThanOrEqual(332);
    });

    it('rodada cancelada some dos mais vendidos e das estações', async () => {
      await rodada({ itens: [{ nome: 'Pizza', quantidade: 1 }] });
      await rodada({
        status: 'CANCELADA',
        itens: [{ nome: 'Picanha', quantidade: 5 }],
      });
      const o = (await painel()).operacao;
      expect(o.maisVendidos).toEqual([{ nome: 'Pizza', quantidade: 1 }]);
      expect(o.estacoes).toHaveLength(1);
      expect(o.estacoes[0].pedidos).toBe(1);
    });

    it('meta da equipe batida publica MetaBatida uma vez, mesmo com cancelar e reconfirmar', async () => {
      const token7 = mesas.find((x) => x.numero === 7)!.token;
      await ligar(ana);
      await meta({ escopo: 'EQUIPE', tipo: 'VALOR', alvo: 2 * mixPreco });
      const cliente = request.agent(t.app.getHttpServer());
      await cliente.post(`/publico/mesas/${token7}/entrar`).expect(200);
      const enviar = async () => {
        await cliente
          .post(`/publico/mesas/${token7}/carrinho/itens`)
          .send({ pratoId, selecao: {}, observacao: '', quantidade: 1 })
          .expect(201);
        return (
          (await cliente.post(`/publico/mesas/${token7}/rodadas`).expect(201))
            .body as { id: string }
        ).id;
      };
      const primeira = await enviar();
      await http()
        .post(`/equipe/rodadas/${primeira}/confirmar`)
        .set('Cookie', ana)
        .expect(200);
      expect(await contarEventos(t, 'MetaBatida', 1)).toBe(0);
      const direta = await enviar();
      expect(await contarEventos(t, 'MetaBatida', 1)).toBe(1);
      await http()
        .post(`/equipe/rodadas/${direta}/cancelar`)
        .set('Cookie', ana)
        .expect(200);
      await enviar();
      expect(await contarEventos(t, 'MetaBatida', 2)).toBe(1);
      const ev = await t.prisma.evento.findFirstOrThrow({
        where: { tipo: 'MetaBatida' },
      });
      expect(ev.dados).toMatchObject({ tipo: 'VALOR', periodo: 'DIA' });
    }, 15_000);
  });
});
