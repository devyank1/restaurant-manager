import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { AuthService } from './auth.service';
import { EquipeGuard } from './equipe.guard';
import { COOKIE_EQUIPE, DURACAO_SESSAO_MS } from './equipe.types';
import type { UsuarioEquipe, UsuarioToken } from './equipe.types';
import { UsuarioAtual } from './usuario-atual.decorator';

const loginSchema = z.object({
  email: z.string().max(200),
  senha: z.string().max(200),
});
const turnoSchema = z.object({ emTurno: z.boolean() });

// Ruling da etapa: secure=false para funcionar em http na rede local;
// revisar no deploy (Etapa 4), quando tudo for HTTPS.
const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  path: '/',
};

@Controller('equipe')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() corpo: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UsuarioEquipe> {
    const { email, senha } = lerCorpo(loginSchema, corpo, 401, {
      mensagem: 'E-mail ou senha inválidos',
    });
    const resultado = await this.auth.entrar(email, senha);
    if (!resultado) {
      throw new UnauthorizedException({
        mensagem: 'E-mail ou senha inválidos',
      });
    }
    res.cookie(COOKIE_EQUIPE, resultado.token, {
      ...OPCOES_COOKIE,
      maxAge: DURACAO_SESSAO_MS,
    });
    return resultado.usuario;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(COOKIE_EQUIPE, OPCOES_COOKIE);
  }

  @Get('eu')
  @UseGuards(EquipeGuard)
  async eu(@UsuarioAtual() usuario: UsuarioToken): Promise<UsuarioEquipe> {
    const atual = await this.auth.buscar(usuario.id);
    // Usuário apagado (ex.: seed refeito) com cookie antigo.
    if (!atual) {
      throw new UnauthorizedException({ mensagem: 'Faça login novamente' });
    }
    return atual;
  }

  @Patch('turno')
  @UseGuards(EquipeGuard)
  turno(
    @UsuarioAtual() usuario: UsuarioToken,
    @Body() corpo: unknown,
  ): Promise<UsuarioEquipe> {
    const { emTurno } = lerCorpo(turnoSchema, corpo);
    return this.auth.mudarTurno(usuario.id, emTurno);
  }
}
