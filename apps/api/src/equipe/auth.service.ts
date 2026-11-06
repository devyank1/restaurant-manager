import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioEquipe, UsuarioToken } from './equipe.types';
import { conferirSenha } from './senha';

type PayloadJwt = { sub: string; restauranteId: string; papel: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** null quando e-mail ou senha não conferem (sem dizer qual). */
  async entrar(
    email: string,
    senha: string,
  ): Promise<{ usuario: UsuarioEquipe; token: string } | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!usuario || !(await conferirSenha(senha, usuario.senhaHash))) {
      return null;
    }
    const payload: PayloadJwt = {
      sub: usuario.id,
      restauranteId: usuario.restauranteId,
      papel: usuario.papel,
    };
    return {
      usuario: paraUsuarioEquipe(usuario),
      token: await this.jwt.signAsync(payload),
    };
  }

  /** Valida o JWT; null se inválido, expirado ou malformado. */
  async lerToken(token: string | undefined): Promise<UsuarioToken | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<PayloadJwt>(token);
      return {
        id: payload.sub,
        restauranteId: payload.restauranteId,
        papel: payload.papel as UsuarioToken['papel'],
      };
    } catch {
      return null;
    }
  }

  async buscar(id: string): Promise<UsuarioEquipe | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    return usuario && paraUsuarioEquipe(usuario);
  }

  async mudarTurno(id: string, emTurno: boolean): Promise<UsuarioEquipe> {
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { emTurno, emTurnoDesde: emTurno ? new Date() : null },
    });
    return paraUsuarioEquipe(usuario);
  }
}

function paraUsuarioEquipe(usuario: Usuario): UsuarioEquipe {
  return {
    id: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
    emTurno: usuario.emTurno,
  };
}
