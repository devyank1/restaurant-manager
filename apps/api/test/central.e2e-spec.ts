import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { CentralAgendador } from '../src/paineis/central.agendador';
import { CentralService } from '../src/paineis/central.service';
import type { CentralResposta } from '../src/paineis/central.types';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type Limites = Record<string, { ativo: boolean; valor: number | null }>;

describe('central de alertas', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
  });

  afterAll(async () => {
    await t.prisma.restaurante.deleteMany({ where: { slug: 'outro-central' } });
    await t.prisma.limiteAlerta.deleteMany();
    await t.fechar();
  });

  const http = () => request(t.app.getHttpServer());

  describe('limites', () => {
    const base = '/equipe/painel/central/limites';
    const ler = async () =>
      (await http().get(base).set('Cookie', dono).expect(200)).body as Limites;

    beforeEach(async () => {
      await t.prisma.limiteAlerta.deleteMany();
    });

    it('garçom recebe 403 em GET e PUT', async () => {
      await http().get(base).set('Cookie', ana).expect(403);
      await http()
        .put(`${base}/MESA_SEM_ATENDIMENTO`)
        .set('Cookie', ana)
        .send({ ativo: true, valor: 15 })
        .expect(403);
    });

    it('sem gravações devolve os padrões', async () => {
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: true, valor: 10 });
      expect(Object.keys(l)).toHaveLength(11);
      expect(l.CHAMADO_PARA_TODOS).toBeDefined();
    });

    it('grava e lê de volta o valor e o desligado', async () => {
      await http()
        .put(`${base}/MESA_SEM_ATENDIMENTO`)
        .set('Cookie', dono)
        .send({ ativo: true, valor: 15 })
        .expect(200);
      await http()
        .put(`${base}/PEDIDO_ESQUECIDO`)
        .set('Cookie', dono)
        .send({ ativo: false, valor: null })
        .expect(200);
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: true, valor: 15 });
      expect(l.PEDIDO_ESQUECIDO).toEqual({ ativo: false, valor: null });
    });

    it('valor null num tipo configurável volta ao padrão', async () => {
      await http()
        .put(`${base}/MESA_SEM_ATENDIMENTO`)
        .set('Cookie', dono)
        .send({ ativo: false, valor: null })
        .expect(200);
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: false, valor: 10 });
    });

    it('rejeita valor fora da faixa ou em tipo sem valor', async () => {
      const put = (tipo: string, corpo: unknown) =>
        http()
          .put(`${base}/${tipo}`)
          .set('Cookie', dono)
          .send(corpo as object);
      await put('PEDIDO_ESQUECIDO', { ativo: true, valor: 5 }).expect(422);
      await put('MESA_SEM_ATENDIMENTO', { ativo: true, valor: 0 }).expect(422);
      await put('MESA_SEM_ATENDIMENTO', { ativo: true, valor: 61 }).expect(422);
      await put('MOVIMENTO_ALTO', { ativo: true, valor: 109 }).expect(422);
      await put('MOVIMENTO_ALTO', { ativo: true, valor: 300 }).expect(200);
      await put('MESA_SEM_ATENDIMENTO', { ativo: 'x', valor: 5 }).expect(422);
    });

    it('tipo desconhecido dá 404', async () => {
      const r = await http()
        .put(`${base}/FOO`)
        .set('Cookie', dono)
        .send({ ativo: true, valor: null })
        .expect(404);
      expect((r.body as { mensagem: string }).mensagem).toBe(
        'Tipo de alerta não encontrado',
      );
    });

    it('limite de um restaurante não aparece para outro', async () => {
      const outro = await t.prisma.restaurante.create({
        data: { nome: 'Outro', slug: 'outro-central' },
      });
      await t.prisma.limiteAlerta.create({
        data: {
          restauranteId: outro.id,
          tipo: 'MESA_SEM_ATENDIMENTO',
          ativo: false,
          valor: 44,
        },
      });
      const l = await ler();
      expect(l.MESA_SEM_ATENDIMENTO).toEqual({ ativo: true, valor: 10 });
    });
  });

  describe('central', () => {
    const MIN = 60_000;
    let central: CentralService;
    let mesasCriadas: string[];
    let restaurantesExtras: string[];

    beforeAll(() => {
      central = t.app.get(CentralService);
    });

    beforeEach(async () => {
      await t.prisma.limiteAlerta.deleteMany();
      mesasCriadas = [];
      restaurantesExtras = [];
    });

    afterEach(async () => {
      // Mesas criadas aqui levam sessões, rodadas e chamados em cascata.
      await t.prisma.mesa.deleteMany({ where: { id: { in: mesasCriadas } } });
      await t.prisma.restaurante.deleteMany({
        where: { id: { in: restaurantesExtras } },
      });
    });

    let seq = 900;
    async function novaSessao(
      restauranteId: string,
      dados: { abertaEm?: Date; garcomId?: string | null } = {},
    ) {
      const numero = seq++;
      const mesa = await t.prisma.mesa.create({
        data: {
          restauranteId,
          numero,
          token: `central-${numero}-${Date.now()}`,
        },
      });
      mesasCriadas.push(mesa.id);
      const sessao = await t.prisma.sessaoMesa.create({
        data: { restauranteId, mesaId: mesa.id, ...dados },
      });
      return { mesa, sessao };
    }

    async function chamar(
      restauranteId: string,
      s: { mesa: { id: string }; sessao: { id: string } },
      criadoEm: Date,
      extra: { garcomId?: string; paraTodos?: boolean } = {},
    ) {
      return t.prisma.chamado.create({
        data: {
          restauranteId,
          mesaId: s.mesa.id,
          sessaoId: s.sessao.id,
          tipo: 'ATENDENTE',
          criadoEm,
          atribuidoEm: criadoEm,
          ...extra,
        },
      });
    }

    const nosEstavel = async (agora: Date, id = t.restauranteId) => {
      await central.calcular(id, agora);
      return (await central.calcular(id, new Date(agora.getTime() + 61_000)))
        .resposta;
    };

    it('garçom recebe 403', async () => {
      await http().get('/equipe/painel/central').set('Cookie', ana).expect(403);
    });

    it('sem atividade: 200 e nenhum alerta', async () => {
      const r = await http()
        .get('/equipe/painel/central')
        .set('Cookie', dono)
        .expect(200);
      const corpo = r.body as CentralResposta;
      expect(corpo.alertas).toEqual([]);
      expect(corpo.cargaEstacoes).toEqual([]);
      expect(corpo.contexto.faturamentoCentavos).toBeGreaterThanOrEqual(0);
      expect(typeof corpo.verificadoEm).toBe('string');
    });

    it('mesa aberta há mais de 10 min só aparece após 60 s', async () => {
      const t0 = new Date();
      const s = await novaSessao(t.restauranteId, {
        abertaEm: new Date(t0.getTime() - 11 * MIN),
      });
      const primeira = await central.calcular(t.restauranteId, t0);
      const chave = `MESA_SEM_ATENDIMENTO:${s.sessao.id}`;
      expect(primeira.resposta.alertas.map((a) => a.chave)).not.toContain(
        chave,
      );
      const segunda = await central.calcular(
        t.restauranteId,
        new Date(t0.getTime() + 61_000),
      );
      const a = segunda.resposta.alertas.find((x) => x.chave === chave);
      expect(a?.tipo).toBe('MESA_SEM_ATENDIMENTO');
      expect(typeof a?.desde).toBe('string');
      expect(segunda.mudou).toBe(true);
    });

    it('chamado aberto há 4 min gera CHAMADO_SEM_RESPOSTA', async () => {
      const t0 = new Date();
      const s = await novaSessao(t.restauranteId, { abertaEm: t0 });
      const c = await chamar(
        t.restauranteId,
        s,
        new Date(t0.getTime() - 4 * MIN),
      );
      const r = await nosEstavel(t0);
      expect(r.alertas.map((a) => a.chave)).toContain(
        `CHAMADO_SEM_RESPOSTA:${c.id}`,
      );
    });

    it('7 itens NA_FILA numa estação geram FILA_ACUMULADA', async () => {
      const t0 = new Date();
      const s = await novaSessao(t.restauranteId, { abertaEm: t0 });
      const prato = await t.prisma.prato.findFirstOrThrow({
        where: { restauranteId: t.restauranteId },
      });
      const rodada = await t.prisma.rodada.create({
        data: {
          restauranteId: t.restauranteId,
          sessaoId: s.sessao.id,
          dispositivoId: 'x',
          status: 'CONFIRMADA',
          totalCentavos: 100,
          confirmadaEm: t0,
        },
      });
      await t.prisma.itemRodada.createMany({
        data: Array.from({ length: 7 }, () => ({
          restauranteId: t.restauranteId,
          rodadaId: rodada.id,
          pratoId: prato.id,
          nome: 'X',
          resumoOpcoes: '',
          selecao: [],
          observacao: '',
          quantidade: 1,
          precoUnitarioCentavos: 100,
          estacao: 'EstacaoCentral',
        })),
      });
      const r = await nosEstavel(t0);
      expect(r.alertas.map((a) => a.chave)).toContain(
        'FILA_ACUMULADA:EstacaoCentral',
      );
      const e = r.cargaEstacoes.find((x) => x.estacao === 'EstacaoCentral');
      expect(e).toMatchObject({ naFila: 7, emPreparo: 0, carga: 7 });
      expect(e?.maisAntigoMin).not.toBeNull();
    });

    it('carga dos garçons: Ana com mesas, ordem alfabética', async () => {
      const t0 = new Date();
      const anaU = await t.prisma.usuario.findUniqueOrThrow({
        where: { email: 'ana@demo.com' },
      });
      const antes = await t.prisma.usuario.findMany({
        where: { restauranteId: t.restauranteId, papel: 'GARCOM' },
        select: { id: true, emTurno: true, emTurnoDesde: true },
      });
      await t.prisma.usuario.updateMany({
        where: { restauranteId: t.restauranteId, papel: 'GARCOM' },
        data: { emTurno: true, emTurnoDesde: t0 },
      });
      try {
        await novaSessao(t.restauranteId, {
          abertaEm: t0,
          garcomId: anaU.id,
        });
        const s2 = await novaSessao(t.restauranteId, {
          abertaEm: t0,
          garcomId: anaU.id,
        });
        await chamar(t.restauranteId, s2, t0, { garcomId: anaU.id });
        await chamar(t.restauranteId, s2, t0, {
          garcomId: anaU.id,
          paraTodos: true,
        });
        const r = (await central.calcular(t.restauranteId, t0)).resposta;
        const nomes = r.cargaGarcons.map((g) => g.nome);
        expect(nomes).toEqual(
          [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        );
        const a = r.cargaGarcons.find((g) => g.id === anaU.id)!;
        expect(a.mesasAbertas).toBeGreaterThanOrEqual(2);
        expect(a.chamadosPendentes).toBe(1);
        expect(a.carga).toBe(a.mesasAbertas + 2);
        expect(r.grupo.garconsEmTurno).toBe(r.cargaGarcons.length);
        expect(r.grupo.cargaTotal).toBe(
          r.cargaGarcons.reduce((s, g) => s + g.carga, 0),
        );
      } finally {
        for (const g of antes) {
          await t.prisma.usuario.update({
            where: { id: g.id },
            data: { emTurno: g.emTurno, emTurnoDesde: g.emTurnoDesde },
          });
        }
      }
    });

    it('dados de outro restaurante não aparecem', async () => {
      const outro = await t.prisma.restaurante.create({
        data: { nome: 'Outro', slug: 'outro-central-dados' },
      });
      restaurantesExtras.push(outro.id);
      const t0 = new Date();
      const s = await novaSessao(outro.id, {
        abertaEm: new Date(t0.getTime() - 30 * MIN),
      });
      const c = await chamar(outro.id, s, new Date(t0.getTime() - 9 * MIN));
      const r = await nosEstavel(t0);
      const chaves = r.alertas.map((a) => a.chave);
      expect(chaves).not.toContain(`MESA_SEM_ATENDIMENTO:${s.sessao.id}`);
      expect(chaves).not.toContain(`CHAMADO_SEM_RESPOSTA:${c.id}`);
      const deles = await nosEstavel(t0, outro.id);
      expect(deles.alertas.map((a) => a.chave)).toContain(
        `CHAMADO_SEM_RESPOSTA:${c.id}`,
      );
    });

    it('tipo desligado nos limites some da lista', async () => {
      const t0 = new Date();
      const s = await novaSessao(t.restauranteId, { abertaEm: t0 });
      const c = await chamar(
        t.restauranteId,
        s,
        new Date(t0.getTime() - 4 * MIN),
      );
      await http()
        .put('/equipe/painel/central/limites/CHAMADO_SEM_RESPOSTA')
        .set('Cookie', dono)
        .send({ ativo: false, valor: null })
        .expect(200);
      const r = await nosEstavel(t0);
      expect(r.alertas.map((a) => a.chave)).not.toContain(
        `CHAMADO_SEM_RESPOSTA:${c.id}`,
      );
    });

    it('faturamento soma contas fechadas do dia de serviço', async () => {
      const agora = new Date();
      const base = (await central.calcular(t.restauranteId, agora)).resposta
        .contexto.faturamentoCentavos;
      const a = await novaSessao(t.restauranteId);
      const b = await novaSessao(t.restauranteId);
      for (const [s, total] of [
        [a, 10_000],
        [b, 5_000],
      ] as const) {
        await t.prisma.sessaoMesa.update({
          where: { id: s.sessao.id },
          data: {
            status: 'FECHADA',
            fechadaEm: agora,
            totalCentavos: total,
          },
        });
      }
      const r = (await central.calcular(t.restauranteId, agora)).resposta;
      expect(r.contexto.faturamentoCentavos).toBe(base + 15_000);
      expect(r.contexto.ticketMedioCentavos).not.toBeNull();
    });
  });
  describe('tempo real', () => {
    const sockets: Socket[] = [];
    const MIN = 60_000;

    afterEach(() => {
      sockets.splice(0).forEach((s) => s.disconnect());
      jest.restoreAllMocks();
    });

    it('emite central-mudou uma vez quando o alerta se confirma', async () => {
      await t.app.listen(0);
      const { port } = (
        t.app.getHttpServer() as unknown as Server
      ).address() as AddressInfo;
      const cookie = await loginComo(t.app, 'dono@demo.com');
      const socket = io(`http://localhost:${port}`, {
        transports: ['websocket'],
        extraHeaders: { Cookie: cookie },
        forceNew: true,
      });
      sockets.push(socket);
      await new Promise<void>((ok) => socket.once('connect', () => ok()));
      await new Promise((ok) => setTimeout(ok, 100));
      let recebidos = 0;
      socket.on('central-mudou', () => recebidos++);
      const agendador = t.app.get(CentralAgendador);

      // Horário futuro: o estado em memória só anda para frente.
      const t0 = new Date(Date.now() + 60 * MIN);
      // Assenta qualquer resto de outros testes antes de contar.
      await agendador.verificar(t0);
      await agendador.verificar(new Date(t0.getTime() + 61_000));
      await new Promise((ok) => setTimeout(ok, 150));
      recebidos = 0;

      const mesa = await t.prisma.mesa.create({
        data: {
          restauranteId: t.restauranteId,
          numero: 9100,
          token: `central-tr-${Date.now()}`,
        },
      });
      try {
        const sessao = await t.prisma.sessaoMesa.create({
          data: { restauranteId: t.restauranteId, mesaId: mesa.id },
        });
        const velho = new Date(t0.getTime() - 4 * MIN);
        await t.prisma.chamado.create({
          data: {
            restauranteId: t.restauranteId,
            mesaId: mesa.id,
            sessaoId: sessao.id,
            tipo: 'ATENDENTE',
            criadoEm: velho,
            atribuidoEm: velho,
          },
        });
        const t1 = new Date(t0.getTime() + 5 * MIN);
        await agendador.verificar(t1);
        await agendador.verificar(new Date(t1.getTime() + 61_000));
        await agendador.verificar(new Date(t1.getTime() + 62_000));
        await new Promise((ok) => setTimeout(ok, 300));
        expect(recebidos).toBe(1);
      } finally {
        await t.prisma.mesa.delete({ where: { id: mesa.id } });
      }
    });

    it('erro em um restaurante não impede os demais', async () => {
      const outro = await t.prisma.restaurante.create({
        data: { nome: 'Outro Agendador', slug: 'outro-agendador' },
      });
      try {
        const central = t.app.get(CentralService);
        const chamados: string[] = [];
        const original = central.calcular.bind(central);
        jest.spyOn(central, 'calcular').mockImplementation((id, agora) => {
          chamados.push(id);
          if (id === t.restauranteId) return Promise.reject(new Error('boom'));
          return original(id, agora);
        });
        await expect(
          t.app
            .get(CentralAgendador)
            .verificar(new Date(Date.now() + 120 * MIN)),
        ).resolves.toBeUndefined();
        expect(chamados).toEqual(
          expect.arrayContaining([t.restauranteId, outro.id]),
        );
      } finally {
        await t.prisma.restaurante.delete({ where: { id: outro.id } });
      }
    });
  });
});
