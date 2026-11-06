import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { lerCorpo } from '../comum/ler-corpo';
import { EquipeGuard } from '../equipe/equipe.guard';
import type { UsuarioToken } from '../equipe/equipe.types';
import { UsuarioAtual } from '../equipe/usuario-atual.decorator';
import { PushService } from './push.service';

const inscricaoSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
});

@Controller('equipe/push')
@UseGuards(EquipeGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('chave')
  chave(): { chavePublica: string | null } {
    return { chavePublica: this.push.chavePublica() };
  }

  @Post('inscricoes')
  @HttpCode(204)
  async inscrever(
    @UsuarioAtual() usuario: UsuarioToken,
    @Body() corpo: unknown,
  ): Promise<void> {
    await this.push.inscrever(usuario, lerCorpo(inscricaoSchema, corpo));
  }
}
