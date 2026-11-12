import request from 'supertest';
import { AppTeste, criarAppTeste, loginComo } from './app-teste';

type MetaValor = { periodo: 'DIA' | 'SEMANA'; alvo: number } | null;
type MetasConfig = {
  equipe: { VALOR: MetaValor; MESAS: MetaValor };
  garcomPadrao: { VALOR: MetaValor; MESAS: MetaValor };
  estacoes: {
    estacao: string;
    noTempoPct: number | null;
    zeroEsquecidos: boolean;
  }[];
  garcons: { id: string; nome: string }[];
  horasSemPausa: number;
};
type MetaPessoa = {
  id: string;
  nome: string;
  VALOR: { padrao: MetaValor; ajuste: number | null };
  MESAS: { padrao: MetaValor; ajuste: number | null };
};

describe('metas', () => {
  let t: AppTeste;
  let dono: string;
  let ana: string;
  let anaId: string;
  let brunoId: string;
  let daniId: string;

  beforeAll(async () => {
    t = await criarAppTeste();
    dono = await loginComo(t.app, 'dono@demo.com');
    ana = await loginComo(t.app, 'ana@demo.com');
    const id = async (email: string) =>
      (await t.prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
    anaId = await id('ana@demo.com');
    brunoId = await id('bruno@demo.com');
    daniId = await id('cozinha@demo.com');
  });

  beforeEach(async () => {
    await t.prisma.meta.deleteMany();
    await t.prisma.restaurante.update({
      where: { id: t.restauranteId },
      data: { horasSemPausa: 4 },
    });
  });

  afterAll(() => t.fechar());

  const http = () => request(t.app.getHttpServer());
  const config = async () =>
    (await http().get('/equipe/metas').set('Cookie', dono).expect(200))
      .body as MetasConfig;
  const pessoa = async (id: string) =>
    (
      await http()
        .get(`/equipe/metas/garcom/pessoa/${id}`)
        .set('Cookie', dono)
        .expect(200)
    ).body as MetaPessoa;
  const put = (url: string, corpo: object, cookie = dono) =>
    http().put(url).set('Cookie', cookie).send(corpo);
  const del = (url: string) => http().delete(url).set('Cookie', dono);

  it('sem nada configurado vem tudo vazio e os garçons em ordem alfabética', async () => {
    const c = await config();
    expect(c.equipe).toEqual({ VALOR: null, MESAS: null });
    expect(c.garcomPadrao).toEqual({ VALOR: null, MESAS: null });
    expect(c.garcons).toEqual([
      { id: anaId, nome: 'Ana' },
      { id: brunoId, nome: 'Bruno' },
    ]);
    expect(c.estacoes).toEqual([
      { estacao: 'Bar', noTempoPct: null, zeroEsquecidos: false },
      { estacao: 'Cozinha', noTempoPct: null, zeroEsquecidos: false },
    ]);
    expect(c.horasSemPausa).toBe(4);
  });

  it('gerente define meta da equipe por semana e lê de volta', async () => {
    await put('/equipe/metas/equipe/VALOR', {
      periodo: 'SEMANA',
      alvo: 200000,
    }).expect(200);
    await put('/equipe/metas/equipe/VALOR', {
      periodo: 'SEMANA',
      alvo: 250000,
    }).expect(200);
    expect((await config()).equipe).toEqual({
      VALOR: { periodo: 'SEMANA', alvo: 250000 },
      MESAS: null,
    });
    expect(await t.prisma.meta.count({ where: { escopo: 'EQUIPE' } })).toBe(1);
    await del('/equipe/metas/equipe/VALOR').expect(204);
    expect((await config()).equipe.VALOR).toBeNull();
  });

  it('alvo 0, negativo, quebrado ou período inválido dá 422', async () => {
    for (const corpo of [
      { periodo: 'DIA', alvo: 0 },
      { periodo: 'DIA', alvo: -5 },
      { periodo: 'DIA', alvo: 1.5 },
      { periodo: 'MES', alvo: 10 },
    ]) {
      await put('/equipe/metas/equipe/MESAS', corpo).expect(422);
    }
    await put('/equipe/metas/equipe/NO_TEMPO', {
      periodo: 'DIA',
      alvo: 10,
    }).expect(422);
  });

  it('padrão do garçom vale para todos; ajuste muda só a pessoa', async () => {
    await put('/equipe/metas/garcom/VALOR', {
      periodo: 'DIA',
      alvo: 80000,
    }).expect(200);
    await put(`/equipe/metas/garcom/pessoa/${anaId}/VALOR`, {
      alvo: 40000,
    }).expect(200);
    expect(await pessoa(anaId)).toEqual({
      id: anaId,
      nome: 'Ana',
      VALOR: { padrao: { periodo: 'DIA', alvo: 80000 }, ajuste: 40000 },
      MESAS: { padrao: null, ajuste: null },
    });
    expect((await pessoa(brunoId)).VALOR).toEqual({
      padrao: { periodo: 'DIA', alvo: 80000 },
      ajuste: null,
    });
    await del(`/equipe/metas/garcom/pessoa/${anaId}/VALOR`).expect(204);
    expect((await pessoa(anaId)).VALOR.ajuste).toBeNull();
  });

  it('ajuste sem padrão dá 422', async () => {
    const res = await put(`/equipe/metas/garcom/pessoa/${anaId}/MESAS`, {
      alvo: 5,
    }).expect(422);
    expect((res.body as { mensagem: string }).mensagem).toBe(
      'Defina a meta padrão primeiro',
    );
  });

  it('apagar o padrão apaga os ajustes', async () => {
    await put('/equipe/metas/garcom/MESAS', {
      periodo: 'SEMANA',
      alvo: 30,
    }).expect(200);
    await put(`/equipe/metas/garcom/pessoa/${brunoId}/MESAS`, {
      alvo: 15,
    }).expect(200);
    await del('/equipe/metas/garcom/MESAS').expect(204);
    expect(await t.prisma.meta.count()).toBe(0);
  });

  it('pessoa que não é garçom dá 404', async () => {
    await http()
      .get(`/equipe/metas/garcom/pessoa/${daniId}`)
      .set('Cookie', dono)
      .expect(404);
    await put('/equipe/metas/garcom/VALOR', { periodo: 'DIA', alvo: 1 });
    await put(`/equipe/metas/garcom/pessoa/${daniId}/VALOR`, {
      alvo: 5,
    }).expect(404);
  });

  it('meta da estação: 85% e zero esquecidos', async () => {
    await put('/equipe/metas/estacao/Cozinha', {
      noTempoPct: 85,
      zeroEsquecidos: true,
    }).expect(200);
    expect((await config()).estacoes).toEqual([
      { estacao: 'Bar', noTempoPct: null, zeroEsquecidos: false },
      { estacao: 'Cozinha', noTempoPct: 85, zeroEsquecidos: true },
    ]);
    await put('/equipe/metas/estacao/Cozinha', {
      noTempoPct: null,
      zeroEsquecidos: false,
    }).expect(200);
    expect(await t.prisma.meta.count()).toBe(0);
    await put('/equipe/metas/estacao/Cozinha', {
      noTempoPct: 101,
      zeroEsquecidos: false,
    }).expect(422);
    await put('/equipe/metas/estacao/Lava-jato', {
      noTempoPct: 80,
      zeroEsquecidos: false,
    }).expect(404);
  });

  it('horas sem pausa de 1 a 12', async () => {
    await http()
      .patch('/equipe/configuracoes/painel')
      .set('Cookie', dono)
      .send({ horasSemPausa: 6 })
      .expect(200);
    expect((await config()).horasSemPausa).toBe(6);
    await http()
      .patch('/equipe/configuracoes/painel')
      .set('Cookie', dono)
      .send({ horasSemPausa: 13 })
      .expect(422);
  });

  it('garçom recebe 403 em todas as rotas de metas', async () => {
    await http().get('/equipe/metas').set('Cookie', ana).expect(403);
    await http()
      .get(`/equipe/metas/garcom/pessoa/${anaId}`)
      .set('Cookie', ana)
      .expect(403);
    await put(
      '/equipe/metas/equipe/VALOR',
      { periodo: 'DIA', alvo: 1 },
      ana,
    ).expect(403);
    await put(
      `/equipe/metas/garcom/pessoa/${anaId}/VALOR`,
      { alvo: 1 },
      ana,
    ).expect(403);
    await http()
      .patch('/equipe/configuracoes/painel')
      .set('Cookie', ana)
      .send({ horasSemPausa: 6 })
      .expect(403);
  });

  it('GET /metas não traz valores por pessoa', async () => {
    await put('/equipe/metas/garcom/VALOR', { periodo: 'DIA', alvo: 80000 });
    await put(`/equipe/metas/garcom/pessoa/${anaId}/VALOR`, { alvo: 40000 });
    const c = await config();
    expect(JSON.stringify(c)).not.toContain('40000');
    for (const g of c.garcons)
      expect(Object.keys(g).sort()).toEqual(['id', 'nome']);
  });
});
