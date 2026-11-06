import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { seedDemo } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

export type AppTeste = {
  app: INestApplication<App>;
  prisma: PrismaClient;
  restauranteId: string;
  fechar: () => Promise<void>;
};

/** Sobe a API como o main.ts (cookies etc.) sobre a demo recém-semeada. */
export async function criarAppTeste(): Promise<AppTeste> {
  const prisma = new PrismaClient();
  const { restauranteId } = await seedDemo(prisma);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.init();
  return {
    app,
    prisma,
    restauranteId,
    fechar: async () => {
      await app.close();
      await prisma.restaurante.deleteMany({ where: { slug: 'demo' } });
      await prisma.$disconnect();
    },
  };
}

/** Faz login e devolve o header `Cookie` da sessão da equipe. */
export async function loginComo(
  app: INestApplication<App>,
  email: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/equipe/login')
    .send({ email, senha: 'demo1234' })
    .expect(200);
  return cookieDe(res.headers['set-cookie'], 'equipe');
}

/** Extrai `nome=valor` de um header set-cookie. */
export function cookieDe(
  setCookie: string | string[] | undefined,
  nome: string,
): string {
  const lista = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const encontrado = lista.find((c) => c.startsWith(`${nome}=`));
  if (!encontrado) throw new Error(`cookie ${nome} ausente`);
  return encontrado.split(';')[0];
}
