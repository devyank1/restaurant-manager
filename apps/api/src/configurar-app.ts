import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configuração comum ao main.ts e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
}
