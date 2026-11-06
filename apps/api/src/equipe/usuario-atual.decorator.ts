import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequisicaoEquipe } from './equipe.guard';
import { UsuarioToken } from './equipe.types';

/** Usuário do token, preenchido pelo EquipeGuard. */
export const UsuarioAtual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): UsuarioToken =>
    contexto.switchToHttp().getRequest<RequisicaoEquipe>().usuario,
);
