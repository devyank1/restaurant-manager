import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { COOKIE_DISPOSITIVO } from './participante';

/** Valor cru do cookie `dispositivo` (validado em exigirParticipante). */
export const Dispositivo = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): string | undefined => {
    const req = contexto.switchToHttp().getRequest<Request>();
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_DISPOSITIVO];
  },
);
