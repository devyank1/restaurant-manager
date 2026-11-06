import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { COOKIE_EQUIPE, UsuarioToken } from './equipe.types';

export type RequisicaoEquipe = Request & { usuario: UsuarioToken };

@Injectable()
export class EquipeGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequisicaoEquipe>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const usuario = await this.auth.lerToken(cookies?.[COOKIE_EQUIPE]);
    if (!usuario) {
      throw new UnauthorizedException({ mensagem: 'Faça login novamente' });
    }
    req.usuario = usuario;
    return true;
  }
}
