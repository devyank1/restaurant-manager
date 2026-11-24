import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioEquipe, UsuarioToken } from './equipe.types';
import { conferirSenha } from './senha';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TURNO_MUDOU, type TurnoMudou } from '../paineis/paineis.types';

type PayloadJwt = { sub: string; restauranteId: string; papel: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly emissor: EventEmitter2,
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

  /** Liga/desliga "Em turno" e registra o turno (pausa = desligar e ligar). */
  async mudarTurno(id: string, emTurno: boolean): Promise<UsuarioEquipe> {
    const agora = new Date();
    const usuario = await this.prisma.$transaction(async (tx) => {
      const aberto = emTurno
        ? await tx.turnoEquipe.findFirst({
            where: { usuarioId: id, fim: null },
          })
        : null;
      // Já em turno: ligar de novo não zera o "desde" (o aviso de pausa conta dele).
      const u = await tx.usuario.update({
        where: { id },
        data: {
          emTurno,
          emTurnoDesde: emTurno ? (aberto?.inicio ?? agora) : null,
        },
      });
      if (emTurno) {
        if (!aberto) {
          await tx.turnoEquipe.create({
            data: {
              restauranteId: u.restauranteId,
              usuarioId: id,
              inicio: agora,
            },
          });
        }
      } else {
        await tx.turnoEquipe.updateMany({
          where: { usuarioId: id, fim: null },
          data: { fim: agora },
        });
      }
      return u;
    });
    const aviso: TurnoMudou = { restauranteId: usuario.restauranteId };
    this.emissor.emit(TURNO_MUDOU, aviso);
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
